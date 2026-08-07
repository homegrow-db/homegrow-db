"""Homegrow DB MCP Server.

Exposes every REST endpoint of the Homegrow DB backend as an MCP tool so an
LLM agent (e.g. Hermes) can do everything the web interface can do.

The tool set is generated at startup from the backend's live OpenAPI spec
(GET /openapi.json). This means the MCP server always stays in sync with the
API: when a new endpoint is added to the backend, it automatically shows up
here without any manual work.

Usage:
    export HGDB_BASE_URL="http://localhost:8000"   # reachable backend URL
    export HGDB_TOKEN=""                            # optional pre-authenticated token
    python server.py                                # speak MCP over stdio

Alternatively list the generated tools without an MCP client:
    python server.py --list-tools
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import sys
from pathlib import Path
from typing import Any

import httpx
from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import TextContent, Tool

BASE_URL = os.environ.get("HGDB_BASE_URL", "http://localhost:8000").rstrip("/")
OPENAPI_URL = f"{BASE_URL}/openapi.json"

# Shared HTTP client. It is intentionally created on first use inside the
# running event loop (httpx requires an active loop for async clients).
_client: httpx.AsyncClient | None = None
_token: str | None = os.environ.get("HGDB_TOKEN") or None

_CREDENTIAL_TOOLS = {"auth_login", "auth_verify_2fa"}


def _get_client() -> httpx.AsyncClient:
    global _client
    if _client is None:
        _client = httpx.AsyncClient(
            base_url=BASE_URL,
            timeout=httpx.Timeout(60.0, connect=10.0),
            headers={"Accept": "application/json"},
        )
    return _client


def _build_headers() -> dict[str, str]:
    if _token:
        return {"Authorization": f"Bearer {_token}"}
    return {}


# ---------------------------------------------------------------------------
# OpenAPI inspection
# ---------------------------------------------------------------------------


def _deref(schema: dict[str, Any], components: dict[str, Any]) -> dict[str, Any]:
    """Resolve $ref objects against the OpenAPI components."""
    while "$ref" in schema:
        ref = schema["$ref"]
        if not ref.startswith("#/components/schemas/"):
            raise ValueError(f"Unsupported $ref: {ref}")
        name = ref.rsplit("/", 1)[1]
        schema = components["schemas"][name]
    result: dict[str, Any] = {k: v for k, v in schema.items() if k != "title"}
    for key in ("properties", "items", "additionalProperties"):
        val = schema.get(key)
        if isinstance(val, dict):
            if key == "items":
                result[key] = _deref(val, components)
            else:
                result[key] = {k: _deref(v, components) for k, v in val.items()}
        elif isinstance(val, list):
            result[key] = [_deref(v, components) for v in val]
    return result


def _sanitize(name: str) -> str:
    return re.sub(r"[^A-Za-z0-9_\-]", "_", name).replace("-", "_")


# Endpoints whose final path segment already describes the action, so no
# generic HTTP verb suffix is appended (e.g. /auth/login -> "auth_login").
VERB_FINAL = {
    "login", "register", "logout", "status", "setup", "enable",
    "disable", "verify", "verify-2fa", "search", "upload",
}


def _path_to_names(path: str, method: str, multipart: bool = False) -> tuple[str, str]:
    """Return (tool_name, human label) for an OpenAPI operation.

    The name is composed from every static path segment plus a verb suffix,
    which keeps each tool unique even when collections and their members share
    a prefix (e.g. "/grows" vs "/grows/{grow_id}").
    """
    raw = [s for s in path.strip("/").split("/") if s]
    statics = [s for s in raw if not s.startswith("{")]
    has_path_param = any(s.startswith("{") for s in raw)

    noun = "_".join(statics) if statics else "root"
    label = f"{method.upper()} {path}"

    last_seg = statics[-1] if statics else ""
    if last_seg in VERB_FINAL:
        return _sanitize(noun), label

    if method == "get":
        verb = "get" if has_path_param else "list"
    elif method == "post":
        verb = "upload" if multipart else "create"
    elif method in ("patch", "put"):
        verb = "update"
    elif method == "delete":
        verb = "delete"
    else:
        verb = method

    return _sanitize(f"{noun}_{verb}"), label


def _extract_parameters(
    operation: dict[str, Any],
    components: dict[str, Any],
    has_multipart: bool,
) -> tuple[dict[str, dict], list[str]]:
    """Flatten path, query and JSON body parameters into one JSON schema."""
    properties: dict[str, dict] = {}
    required: list[str] = []

    for param in operation.get("parameters", []):
        name = param["name"]
        if param["in"] not in ("path", "query"):
            continue
        # The auth dependency accepts an optional `token` query param; the MCP
        # manages the token automatically via the Authorization header, so this
        # is hidden from the agent to keep the tool signatures clean.
        if param["in"] == "query" and name == "token":
            continue
        schema = _deref(param.get("schema", {"type": "string"}), components)
        prop = {"type": schema.get("type", "string"), "description": param.get("description") or name}
        if schema.get("enum"):
            prop["enum"] = schema["enum"]
        properties[name] = prop
        if param["in"] == "path" or param.get("required"):
            required.append(name)

    if has_multipart:
        properties["file_path"] = {
            "type": "string",
            "description": "Absolute path to the image file on the host running this MCP server.",
        }
        required.append("file_path")
        return properties, required

    request_body = operation.get("requestBody") or {}
    content = request_body.get("content") or {}
    json_schema = content.get("application/json", {}).get("schema")
    if json_schema:
        resolved = _deref(json_schema, components)
        for key, val in (resolved.get("properties") or {}).items():
            prop = {
                "type": val.get("type", "string"),
                "description": val.get("description") or key,
            }
            if val.get("enum"):
                prop["enum"] = val["enum"]
            if val.get("format"):
                prop["format"] = val["format"]
            properties[key] = prop
        for req in resolved.get("required") or []:
            if req not in required:
                required.append(req)

    return properties, required


def _is_multipart(operation: dict[str, Any]) -> bool:
    request_body = operation.get("requestBody") or {}
    content = request_body.get("content") or {}
    return bool(content.get("multipart/form-data"))


def build_tools(openapi: dict[str, Any]) -> list[Tool]:
    components: dict[str, Any] = openapi.get("components") or {}
    paths: dict[str, Any] = openapi.get("paths") or {}
    tools: list[Tool] = []

    # Keep deterministic ordering: sort by path, then by method priority.
    method_order = {"get": 0, "post": 1, "patch": 2, "put": 3, "delete": 4}
    for path in sorted(paths):
        for method, operation in sorted(
            paths[path].items(), key=lambda kv: method_order.get(kv[0], 5)
        ):
            if method not in ("get", "post", "patch", "put", "delete"):
                continue
            multipart = _is_multipart(operation)
            tool_name, label = _path_to_names(path, method, multipart)
            properties, required = _extract_parameters(operation, components, multipart)

            summary = operation.get("summary") or ""
            description = operation.get("description") or summary
            tool_description = (
                f"{summary}\n{description}\nHTTP: {label}\n"
                f"Returns the backend JSON response. "
                f"Requires an authenticated token (use auth_login first if HGDB_TOKEN is not set)."
            ).strip()

            tools.append(
                Tool(
                    name=tool_name,
                    description=tool_description,
                    inputSchema={
                        "type": "object",
                        "properties": properties,
                        "required": required,
                    },
                )
            )
    return tools


# ---------------------------------------------------------------------------
# Tool invocation
# ---------------------------------------------------------------------------


async def _invoke(tool_name: str, arguments: dict[str, Any]) -> list[TextContent]:
    openapi = await _load_openapi()
    components: dict[str, Any] = openapi.get("components") or {}
    paths: dict[str, Any] = openapi.get("paths") or {}

    target = None
    method_order = {"get": 0, "post": 1, "patch": 2, "put": 3, "delete": 4}
    for path in paths:
        for method, operation in paths[path].items():
            if method not in method_order:
                continue
            name, _ = _path_to_names(path, method, _is_multipart(operation))
            if name == tool_name:
                target = (path, method, operation)
                break
        if target:
            break

    if not target:
        return [TextContent(type="text", text=f"Unknown tool: {tool_name}")]

    path_template, method, operation = target
    multipart = _is_multipart(operation)

    # Split arguments into path params, query params and body fields.
    path_params: dict[str, str] = {}
    query_params: dict[str, Any] = {}
    for param in operation.get("parameters", []):
        name = param["name"]
        if name not in arguments:
            continue
        if param["in"] == "path":
            path_params[name] = str(arguments[name])
        elif param["in"] == "query":
            query_params[name] = arguments[name]

    url = path_template
    for key, value in path_params.items():
        url = url.replace("{" + key + "}", value)

    headers = _build_headers()
    client = _get_client()

    if multipart:
        file_path = Path(arguments["file_path"])
        if not file_path.is_file():
            return [TextContent(type="text", text=f"File not found: {file_path}")]
        mime = "application/octet-stream"
        try:
            import mimetypes
            mime = mimetypes.guess_type(file_path.name)[0] or mime
        except Exception:
            pass
        with file_path.open("rb") as fh:
            files = {"file": (file_path.name, fh, mime)}
            resp = await client.request(method, url, params=query_params, files=files, headers=headers)
    else:
        body_fields = set(arguments) - set(path_params) - set(query_params)
        body = {k: arguments[k] for k in body_fields} if body_fields else None
        resp = await client.request(method, url, params=query_params, json=body, headers=headers)

    return await _format_response(resp, method)


async def _format_response(resp: httpx.Response, method: str) -> list[TextContent]:
    if resp.status_code == 204:
        return [TextContent(type="text", text=json.dumps({"ok": True, "status": 204}))]

    content_type = resp.headers.get("content-type", "")
    if "application/json" in content_type:
        try:
            payload = resp.json()
        except Exception:
            payload = {"error": "invalid json response", "body": resp.text[:500]}
        if resp.is_error:
            payload = {"error": payload, "status": resp.status_code}
        return [TextContent(type="text", text=json.dumps(payload, ensure_ascii=False, indent=2))]

    if resp.is_error:
        return [TextContent(type="text", text=f"HTTP {resp.status_code}: {resp.text[:500]}")]

    # Binary payload (e.g. images): return metadata instead of the raw bytes.
    return [
        TextContent(
            type="text",
            text=json.dumps(
                {
                    "status": resp.status_code,
                    "content_type": content_type,
                    "size_bytes": len(resp.content),
                },
                indent=2,
            ),
        )
    ]


async def _apply_credentials(tool_name: str, arguments: dict[str, Any], resp_text: str) -> None:
    """Persist tokens from login / 2FA-verify calls for subsequent requests."""
    global _token
    if tool_name == "auth_login":
        try:
            data = json.loads(resp_text)
        except Exception:
            return
        if data.get("access_token"):
            _token = data["access_token"]
        elif data.get("temp_token"):
            _token = data["temp_token"]
    elif tool_name == "auth_verify_2fa":
        try:
            data = json.loads(resp_text)
        except Exception:
            return
        if data.get("access_token"):
            _token = data["access_token"]


async def _load_openapi() -> dict[str, Any]:
    openapi = getattr(_load_openapi, "cache", None)
    if openapi is None:
        resp = await _get_client().get(OPENAPI_URL, headers=_build_headers())
        resp.raise_for_status()
        openapi = resp.json()
        _load_openapi.cache = openapi
    return openapi


# ---------------------------------------------------------------------------
# MCP server
# ---------------------------------------------------------------------------

server = Server("homegrow-db")


async def _tools() -> list[Tool]:
    cached = getattr(_tools, "cache", None)
    if cached is None:
        try:
            openapi = await _load_openapi()
            cached = build_tools(openapi)
        except Exception as exc:
            cached = [
                Tool(
                    name="mcp_error",
                    description=(
                        "Could not fetch the backend OpenAPI spec. "
                        f"Check that HGDB_BASE_URL ({BASE_URL}) is reachable. Error: {exc}"
                    ),
                    inputSchema={"type": "object", "properties": {}},
                )
            ]
        _tools.cache = cached
    return cached


@server.list_tools()
async def list_tools() -> list[Tool]:
    return await _tools()


@server.call_tool()
async def call_tool(name: str, arguments: dict[str, Any]) -> list[TextContent]:
    try:
        result = await _invoke(name, arguments)
        if name in _CREDENTIAL_TOOLS:
            text = result[0].text if result else ""
            await _apply_credentials(name, arguments, text)
        return result
    except Exception as exc:
        return [TextContent(type="text", text=f"Error calling {name}: {exc}")]


async def run_stdio() -> None:
    async with stdio_server() as (read_stream, write_stream):
        await server.run(read_stream, write_stream, server.create_initialization_options())


def _main() -> None:
    if "--list-tools" in sys.argv:
        try:
            openapi = asyncio.run(_load_openapi())
        except Exception as exc:
            print(f"Could not load OpenAPI spec from {BASE_URL}: {exc}")
            sys.exit(1)
        for tool in build_tools(openapi):
            print(f"- {tool.name}: {tool.description.splitlines()[0]}")
            print(f"    schema: {json.dumps(tool.inputSchema)}")
        return
    asyncio.run(run_stdio())


if __name__ == "__main__":
    _main()
