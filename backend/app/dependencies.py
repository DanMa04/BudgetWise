import hashlib
from datetime import datetime, timezone

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.extension_token import ExtensionToken
from app.models.user import User
from app.services.auth_service import get_or_create_user, verify_clerk_token

security = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    try:
        payload = await verify_clerk_token(credentials.credentials)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )

    sub = payload.get("sub")
    if not sub:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token claims")

    email = payload.get("email", payload.get("email_addresses", [{}])[0].get("email_address", ""))
    name = payload.get("name", payload.get("first_name", ""))

    user = await get_or_create_user(db, auth_provider_id=sub, email=email, display_name=name)
    return user


async def get_extension_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Accept either a Clerk JWT or a long-lived extension token."""
    token = credentials.credentials

    # Try Clerk JWT first
    try:
        payload = await verify_clerk_token(token)
        sub = payload.get("sub")
        if sub:
            email = payload.get("email", payload.get("email_addresses", [{}])[0].get("email_address", ""))
            name = payload.get("name", payload.get("first_name", ""))
            return await get_or_create_user(db, auth_provider_id=sub, email=email, display_name=name)
    except Exception:
        pass

    # Fall back to extension token
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    result = await db.execute(
        select(ExtensionToken).where(
            ExtensionToken.token_hash == token_hash,
            ExtensionToken.is_active.is_(True),
            ExtensionToken.expires_at > datetime.now(timezone.utc),
        )
    )
    ext_token = result.scalar_one_or_none()
    if not ext_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")

    ext_token.last_used_at = datetime.now(timezone.utc)
    await db.flush()

    user = await db.get(User, ext_token.user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user
