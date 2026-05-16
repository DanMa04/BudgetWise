from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.middleware.rate_limit import limiter
from app.models.user import User
from app.schemas.extension import (
    BudgetCheckResponse,
    CartCheckRequest,
    CartCheckResponse,
)
from app.services.extension_service import (
    check_cart_against_budgets,
    get_budget_status,
)

router = APIRouter(prefix="/extension", tags=["extension"])


@router.get("/budget-check", response_model=BudgetCheckResponse)
@limiter.limit("30/minute")
async def budget_check(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await get_budget_status(db, current_user.id)


@router.post("/cart-check", response_model=CartCheckResponse)
@limiter.limit("30/minute")
async def cart_check(
    request: Request,
    data: CartCheckRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await check_cart_against_budgets(
        db, current_user.id, data.cart_total, data.merchant, data.site
    )
