# Homegrow DB – MCP Server

Ein [Model Context Protocol (MCP)](https://modelcontextprotocol.io) Server, der
jeden REST-Endpoint der Homegrow-DB-App als MCP-Tool bereitstellt. Damit kann ein
LLM-Agent (z.B. Hermes) **alles** tun, was man über das Web-Interface machen kann:
Strains, Samen, Grows, Wochen, Ernten, Ereignisse und Bilder verwalten.

Ein wichtiger Vorteil: **Die Tools werden beim Start automatisch aus der live
OpenAPI-Spec des Backends erzeugt** (`GET /openapi.json`). Wird die App erweitert,
fügt sich das MCP automatisch an – es muss nichts manuell synchronisiert werden.

## Wie es funktioniert

1. Der Server lädt beim Start (`initialize`) die OpenAPI-Spec vom Backend.
2. Für jede REST-Operation wird ein Tool generiert (z. B. `strains_create`,
   `grows_weeks_images_upload`, `auth_verify_2fa`).
3. Aufrufe werden als HTTP-Requests an das Backend geschickt; Authentifizierung
   übernimmt der Server automatisch (siehe unten).
4. Bild-Uploads (`multipart/form-data`) werden als Tool mit einem `file_path`
   angeboten – der Agent übergibt den Pfad zu einer lokalen Bilddatei.

## Voraussetzungen

- Python 3.11+
- Das Backend erreichbar (lokal oder im Netz).

Installation der Abhängigkeiten:

```bash
cd hgdb-mcp
pip install -r requirements.txt
```

## Konfiguration (Umgebungsvariablen)

| Variable        | Standardwert          | Bedeutung                                   |
|-----------------|-----------------------|---------------------------------------------|
| `HGDB_BASE_URL` | `http://localhost:8000` | Erreichbare Basis-URL des Backends         |
| `HGDB_TOKEN`    | (leer)                | Optional vorbefülltes Zugriffstoken         |

Das Backend wird in Docker üblicherweise über `http://localhost:80` oder
`http://<host-ip>:80` erreichbar sein. Passe `HGDB_BASE_URL` entsprechend an.

## Starten (stdio – für Hermes / MCP-Clients)

```bash
export HGDB_BASE_URL="http://localhost:80"   # anpassen
python server.py
```

Hilfe/Liste der generierten Tools anzeigen (ohne MCP-Client):

```bash
HGDB_BASE_URL="http://localhost:80" python server.py --list-tools
```

### Als Tool in einem MCP-Client/Bot registrieren

Gibt ein JSON-Tool-Server (stdio). Je nach MCP-Client registrieren, hier ein
Beispiel für Claude Code / kompatible Clients (in dessen Konfiguration):

```json
{
  "mcpServers": {
    "homegrow-db": {
      "command": "python",
      "args": ["/abs/pfad/zu/hgdb-mcp/server.py"],
      "env": { "HGDB_BASE_URL": "http://localhost:80" }
    }
  }
}
```

Details zur Client-spezifischen Registrierung findest du in der Doku deines
Agenten (Hermes).

## Authentifizierung

Der Server verwaltet das Token selbst:

1. Optional `HGDB_TOKEN` setzen (z. B. via `/auth/login` vorab geholt).
2. Oder der Agent ruft zuerst `auth_login` (Benutzername/Passwort) auf. Der
   Server speichert das `access_token` und hängt es automatisch an alle
   weiteren, authentifizierten Requests an.
3. Bei 2FA-Registration: `auth_login` liefert `requires_2fa` + `temp_token`;
   danach `auth_verify_2fa` mit dem Code; danach ist alles erledigt.

Der optionale `token`-Queryparameter ist in den Tool-Schemas ausgeblendet, da
die Auth automatisch erfolgt.

## Synchronisation bei App-Änderungen

Weil die Tools aus der OpenAPI-Spec generiert werden:

- Neue Endpoint → erscheinen automatisch nach Neustart des MCP-Servers.
- Geänderte Signatur/Felder → automatisch übernommen.
- Es gibt **keine** manuell gepflegte Tool-Map.

Hinweis: Der Server cached die Tools nach dem ersten `tools/list` für die
Lebensdauer des Prozesses. Nach App-Updates den MCP-Server einmal neu starten.

## Projektstruktur

```
hgdb-mcp/
  server.py          # MCP-Server + OpenAPI->Tool-Generierung
  requirements.txt   # Abhängigkeiten (mcp, httpx)
  README.md          # diese Datei
```