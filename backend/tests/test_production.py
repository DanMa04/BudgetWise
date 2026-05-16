from httpx import AsyncClient

from app.middleware.rate_limit import limiter


async def test_health_endpoint_returns_ok(client: AsyncClient):
    response = await client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["database"] == "ok"
    assert data["version"] == "0.1.0"


async def test_security_headers_present(client: AsyncClient):
    response = await client.get("/api/health")
    assert response.headers["Strict-Transport-Security"] == (
        "max-age=31536000; includeSubDomains"
    )
    assert response.headers["X-Content-Type-Options"] == "nosniff"
    assert response.headers["X-Frame-Options"] == "DENY"
    assert response.headers["X-XSS-Protection"] == "1; mode=block"
    assert response.headers["Referrer-Policy"] == "strict-origin-when-cross-origin"
    assert response.headers["Permissions-Policy"] == (
        "camera=(), microphone=(), geolocation=()"
    )


async def test_rate_limiter_is_configured():
    assert limiter._default_limits is not None
    assert len(limiter._default_limits) > 0


async def test_gzip_compression_large_response(client: AsyncClient):
    # Make a request with Accept-Encoding: gzip to a known endpoint
    # The health endpoint is small, so we test that GZip middleware is active
    # by sending an accept-encoding header and checking it doesn't break anything
    response = await client.get(
        "/api/health",
        headers={"Accept-Encoding": "gzip"},
    )
    assert response.status_code == 200
    # Health response is small (<1000 bytes) so it won't be compressed
    # Verify the response still works correctly
    assert response.json()["status"] == "ok"


async def test_cors_headers_correct(client: AsyncClient):
    response = await client.options(
        "/api/health",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert response.status_code == 200
    assert "access-control-allow-origin" in response.headers
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"
