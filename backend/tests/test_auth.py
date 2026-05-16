from httpx import ASGITransport, AsyncClient

from app.database import get_db
from app.main import app


async def test_health_endpoint(client: AsyncClient):
    response = await client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["database"] == "ok"
    assert data["version"] == "0.1.0"


async def test_get_me_returns_user(client: AsyncClient):
    response = await client.get("/api/v1/auth/me")
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "test@example.com"
    assert data["display_name"] == "Test User"
    assert data["currency_code"] == "USD"


async def test_get_me_unauthenticated():
    transport = ASGITransport(app=app)
    app.dependency_overrides.pop(get_db, None)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.get("/api/v1/auth/me")
        assert response.status_code in (401, 403)


async def test_update_me(client: AsyncClient):
    response = await client.patch(
        "/api/v1/auth/me",
        json={"display_name": "Updated Name", "currency_code": "EUR"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["display_name"] == "Updated Name"
    assert data["currency_code"] == "EUR"


async def test_update_me_partial(client: AsyncClient):
    response = await client.patch(
        "/api/v1/auth/me",
        json={"timezone": "Europe/London"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["timezone"] == "Europe/London"
    assert data["display_name"] == "Test User"


async def test_cors_headers(client: AsyncClient):
    response = await client.options(
        "/api/v1/auth/me",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert response.status_code == 200
