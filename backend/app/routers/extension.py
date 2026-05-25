import hashlib
import secrets
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user, get_extension_user
from app.middleware.rate_limit import limiter
from app.models.extension_token import ExtensionToken
from app.models.user import User
from app.schemas.extension import (
    BudgetCheckResponse,
    CartCheckRequest,
    CartCheckResponse,
    ExtensionTokenResponse,
    ExtensionTokenStatus,
)
from app.services.extension_service import (
    check_cart_against_budgets,
    get_budget_status,
)

router = APIRouter(prefix="/extension", tags=["extension"])

TOKEN_TTL_DAYS = 90


# ---------------------------------------------------------------------------
# Token management (called from the web app with Clerk JWT)
# ---------------------------------------------------------------------------

@router.post("/tokens", response_model=ExtensionTokenResponse, status_code=status.HTTP_201_CREATED)
async def create_extension_token(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Revoke any existing active token for this user
    await db.execute(
        update(ExtensionToken)
        .where(ExtensionToken.user_id == current_user.id, ExtensionToken.is_active.is_(True))
        .values(is_active=False)
    )

    plain_token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(plain_token.encode()).hexdigest()
    expires_at = datetime.now(timezone.utc) + timedelta(days=TOKEN_TTL_DAYS)

    ext_token = ExtensionToken(
        id=uuid.uuid4(),
        user_id=current_user.id,
        token_hash=token_hash,
        expires_at=expires_at,
    )
    db.add(ext_token)
    await db.flush()

    return ExtensionTokenResponse(token=plain_token, expires_at=expires_at)


@router.delete("/tokens", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_extension_token(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await db.execute(
        update(ExtensionToken)
        .where(ExtensionToken.user_id == current_user.id, ExtensionToken.is_active.is_(True))
        .values(is_active=False)
    )
    await db.flush()


@router.get("/tokens/status", response_model=ExtensionTokenStatus)
async def get_token_status(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ExtensionToken).where(
            ExtensionToken.user_id == current_user.id,
            ExtensionToken.is_active.is_(True),
            ExtensionToken.expires_at > datetime.now(timezone.utc),
        )
    )
    ext_token = result.scalar_one_or_none()
    if not ext_token:
        return ExtensionTokenStatus(is_connected=False)
    return ExtensionTokenStatus(is_connected=True, expires_at=ext_token.expires_at)


# ---------------------------------------------------------------------------
# Budget data endpoints (called from the extension with extension token)
# ---------------------------------------------------------------------------

@router.get("/budget-check", response_model=BudgetCheckResponse)
@limiter.limit("30/minute")
async def budget_check(
    request: Request,
    current_user: User = Depends(get_extension_user),
    db: AsyncSession = Depends(get_db),
):
    return await get_budget_status(db, current_user.id)


@router.post("/cart-check", response_model=CartCheckResponse)
@limiter.limit("30/minute")
async def cart_check(
    request: Request,
    data: CartCheckRequest,
    current_user: User = Depends(get_extension_user),
    db: AsyncSession = Depends(get_db),
):
    return await check_cart_against_budgets(
        db, current_user.id, data.cart_total, data.merchant, data.site
    )
