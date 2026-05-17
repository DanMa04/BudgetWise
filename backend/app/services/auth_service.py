import httpx
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.user import User
from app.services.categorization_service import seed_default_rules
from app.services.category_service import seed_default_categories

CLERK_JWKS_URL = "https://api.clerk.com/v1/jwks"

_jwks_cache: dict | None = None


async def get_clerk_jwks() -> dict:
    global _jwks_cache
    if _jwks_cache is None:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                CLERK_JWKS_URL,
                headers={"Authorization": f"Bearer {settings.clerk_secret_key}"},
            )
            resp.raise_for_status()
            _jwks_cache = resp.json()
    return _jwks_cache


async def verify_clerk_token(token: str) -> dict:
    jwks = await get_clerk_jwks()
    unverified_header = jwt.get_unverified_header(token)
    key = None
    for k in jwks.get("keys", []):
        if k["kid"] == unverified_header.get("kid"):
            key = k
            break
    if key is None:
        raise JWTError("No matching key found")
    payload = jwt.decode(token, key, algorithms=["RS256"], options={"verify_aud": False})
    return payload


async def get_or_create_user(
    db: AsyncSession, auth_provider_id: str, email: str, display_name: str | None = None
) -> User:
    stmt = select(User).where(User.auth_provider_id == auth_provider_id)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if user is None:
        user = User(
            auth_provider_id=auth_provider_id,
            email=email,
            display_name=display_name,
        )
        db.add(user)
        await db.flush()
        await seed_default_categories(db, user.id)
        await seed_default_rules(db, user.id)

    return user
