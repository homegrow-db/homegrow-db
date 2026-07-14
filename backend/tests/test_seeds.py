import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_seed(client: AsyncClient, auth_headers: dict):
    strain = await client.post(
        "/strains", json={"name": "OG Kush"}, headers=auth_headers
    )
    strain_id = strain.json()["id"]
    resp = await client.post(
        "/seeds",
        json={
            "strain_id": strain_id,
            "quantity": 10,
            "source": "Seedbank XYZ",
        },
        headers=auth_headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["quantity"] == 10
    assert data["status"] == "storage"


@pytest.mark.asyncio
async def test_create_seed_invalid_strain(client: AsyncClient, auth_headers: dict):
    resp = await client.post(
        "/seeds",
        json={
            "strain_id": "00000000-0000-0000-0000-000000000000",
            "quantity": 5,
        },
        headers=auth_headers,
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_list_seeds(client: AsyncClient, auth_headers: dict):
    resp = await client.get("/seeds", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "items" in data
    assert "total" in data


@pytest.mark.asyncio
async def test_update_seed_status(client: AsyncClient, auth_headers: dict):
    strain = await client.post(
        "/strains", json={"name": "AK-47"}, headers=auth_headers
    )
    strain_id = strain.json()["id"]
    create = await client.post(
        "/seeds",
        json={"strain_id": strain_id, "quantity": 3},
        headers=auth_headers,
    )
    seed_id = create.json()["id"]
    resp = await client.patch(
        f"/seeds/{seed_id}",
        json={"status": "germinating"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "germinating"
