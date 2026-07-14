import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_strain(client: AsyncClient, auth_headers: dict):
    resp = await client.post(
        "/strains",
        json={
            "name": "Blue Dream",
            "breeder": "DJ Short",
            "genetics": "Sativa",
            "thc_content": 21.0,
            "cbd_content": 0.5,
            "description": "A classic sativa-dominant hybrid",
        },
        headers=auth_headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Blue Dream"
    assert data["thc_content"] == 21.0
    assert "id" in data


@pytest.mark.asyncio
async def test_list_strains(client: AsyncClient, auth_headers: dict):
    resp = await client.get("/strains", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "items" in data
    assert "total" in data


@pytest.mark.asyncio
async def test_list_strains_pagination(client: AsyncClient, auth_headers: dict):
    for i in range(5):
        await client.post(
            "/strains",
            json={"name": f"Strain {i}"},
            headers=auth_headers,
        )
    resp = await client.get("/strains?skip=0&limit=2", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["items"]) == 2
    assert data["total"] >= 5
    assert data["skip"] == 0
    assert data["limit"] == 2


@pytest.mark.asyncio
async def test_get_strain(client: AsyncClient, auth_headers: dict):
    create = await client.post(
        "/strains",
        json={"name": "Northern Lights"},
        headers=auth_headers,
    )
    strain_id = create.json()["id"]
    resp = await client.get(f"/strains/{strain_id}", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["name"] == "Northern Lights"


@pytest.mark.asyncio
async def test_update_strain(client: AsyncClient, auth_headers: dict):
    create = await client.post(
        "/strains",
        json={"name": "Old Name"},
        headers=auth_headers,
    )
    strain_id = create.json()["id"]
    resp = await client.patch(
        f"/strains/{strain_id}",
        json={"name": "New Name", "thc_content": 25.0},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["name"] == "New Name"
    assert resp.json()["thc_content"] == 25.0


@pytest.mark.asyncio
async def test_delete_strain(client: AsyncClient, auth_headers: dict):
    create = await client.post(
        "/strains",
        json={"name": "To Delete"},
        headers=auth_headers,
    )
    strain_id = create.json()["id"]
    resp = await client.delete(f"/strains/{strain_id}", headers=auth_headers)
    assert resp.status_code == 204
    resp = await client.get(f"/strains/{strain_id}", headers=auth_headers)
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_get_strain_not_found(client: AsyncClient, auth_headers: dict):
    resp = await client.get(
        "/strains/00000000-0000-0000-0000-000000000000",
        headers=auth_headers,
    )
    assert resp.status_code == 404
