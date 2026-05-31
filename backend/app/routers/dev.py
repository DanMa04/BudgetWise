from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.middleware.rate_limit import limiter
from app.models.user import User
from app.services import dev_service

router = APIRouter(prefix="/dev", tags=["dev"])


class WipeResponse(BaseModel):
    wiped: dict[str, int]


class ResetBudgetResponse(BaseModel):
    budgets_deleted: int
    goals_zeroed: int


@router.post("/wipe-all", response_model=WipeResponse)
@limiter.limit("5/hour")
async def wipe_all(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    counts = await dev_service.wipe_all_data(db, current_user)
    return WipeResponse(wiped=counts)


@router.post("/reset-budget", response_model=ResetBudgetResponse)
@limiter.limit("10/hour")
async def reset_budget(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await dev_service.reset_budget_only(db, current_user)
    return ResetBudgetResponse(**result)
