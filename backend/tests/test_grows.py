from datetime import date

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_grow(client: AsyncClient, auth_headers: dict):
    strain = await client.post(
        "/strains", json={"name": "Haze"}, headers=auth_headers
    )
    strain_id = strain.json()["id"]
    resp = await client.post(
        "/grows",
        json={
            "strain_id": strain_id,
            "name": "Summer Grow 2026",
            "start_date": str(date.today()),
        },
        headers=auth_headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Summer Grow 2026"
    assert data["status"] == "planned"


@pytest.mark.asyncio
async def test_list_grows(client: AsyncClient, auth_headers: dict):
    resp = await client.get("/grows", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "items" in data
    assert "total" in data


@pytest.mark.asyncio
async def test_create_grow_event(client: AsyncClient, auth_headers: dict):
    strain = await client.post(
        "/strains", json={"name": "White Widow"}, headers=auth_headers
    )
    strain_id = strain.json()["id"]
    grow = await client.post(
        "/grows",
        json={
            "strain_id": strain_id,
            "name": "Test Grow",
            "start_date": str(date.today()),
        },
        headers=auth_headers,
    )
    grow_id = grow.json()["id"]
    resp = await client.post(
        f"/grows/{grow_id}/events",
        json={
            "event_type": "seed_sowing",
            "description": "Placed seeds in soil",
        },
        headers=auth_headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["event_type"] == "seed_sowing"
    assert data["description"] == "Placed seeds in soil"


@pytest.mark.asyncio
async def test_list_grow_events(client: AsyncClient, auth_headers: dict):
    strain = await client.post(
        "/strains", json={"name": "Amnesia"}, headers=auth_headers
    )
    strain_id = strain.json()["id"]
    grow = await client.post(
        "/grows",
        json={
            "strain_id": strain_id,
            "name": "Event Test",
            "start_date": str(date.today()),
        },
        headers=auth_headers,
    )
    grow_id = grow.json()["id"]
    resp = await client.get(f"/grows/{grow_id}/events", headers=auth_headers)
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)
