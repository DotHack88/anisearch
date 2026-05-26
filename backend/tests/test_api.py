import pytest
from httpx import AsyncClient, ASGITransport
from backend.main import app

@pytest.mark.asyncio
async def test_status():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.get("/status")
    assert response.status_code == 200
    data = response.json()
    assert "cached_anime" in data

@pytest.mark.asyncio
async def test_search_returns_list():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.get("/search", params={"q": "naruto"})
    assert response.status_code == 200
    assert "results" in response.json()

@pytest.mark.asyncio
async def test_cache_refresh_requires_auth():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.post("/cache/refresh")
    # Senza token deve restituire 401 o 422
    assert response.status_code in (401, 422)
