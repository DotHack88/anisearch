import pytest
import httpx
from backend.main import app

@pytest.fixture
async def async_client():
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

async def test_root(async_client):
    response = await async_client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "AniSearch API"
    assert "endpoints" in data

async def test_status(async_client):
    response = await async_client.get("/status")
    assert response.status_code == 200
    data = response.json()
    assert "status" in data
    assert "cached_anime" in data
    assert "cache_ready" in data

async def test_filters(async_client):
    response = await async_client.get("/filters")
    assert response.status_code == 200
    data = response.json()
    assert "genres" in data
    assert "years" in data
    assert "statuses" in data
    assert isinstance(data["genres"], list)

async def test_catalog(async_client):
    response = await async_client.get("/catalog?page=0&per_page=10")
    assert response.status_code == 200
    data = response.json()
    assert "total" in data
    assert "items" in data
    assert isinstance(data["items"], list)

async def test_search(async_client):
    response = await async_client.get("/search?q=naruto")
    assert response.status_code == 200
    data = response.json()
    assert "results" in data
    assert "count" in data

async def test_social_login_endpoints(async_client):
    res_google = await async_client.get("/auth/google/login")
    assert res_google.status_code == 200
    assert res_google.json().get("configured") is False

    res_discord = await async_client.get("/auth/discord/login")
    assert res_discord.status_code == 200
    assert res_discord.json().get("configured") is False

async def test_manga_sync_archive_protected(async_client):
    response = await async_client.post("/manga/sync-archive")
    assert response.status_code in (401, 422, 500)
