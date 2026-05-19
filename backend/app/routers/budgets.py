import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.budget import (
    AllocationData,
    BudgetCreate,
    BudgetRead,
    BudgetSummary,
    BudgetUpdate,
    BudgetWithSpend,
    BulkBudgetResponse,
    BulkBudgetSave,
)
from app.services.budget_service import (
    create_budget,
    delete_budget,
    get_allocation_data,
    get_budget,
    get_budget_summary,
    get_budgets_with_spend,
    save_bulk_allocation,
    update_budget,
)

router = APIRouter(prefix="/budgets", tags=["budgets"])


@router.post("/", response_model=BudgetRead, status_code=status.HTTP_201_CREATED)
async def create_budget_endpoint(
    data: BudgetCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    budget = await create_budget(db, current_user.id, data)
    return budget


@router.get("/", response_model=list[BudgetWithSpend])
async def list_budgets(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await get_budgets_with_spend(db, current_user.id)


@router.get("/summary", response_model=BudgetSummary)
async def budget_summary(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await get_budget_summary(db, current_user.id)


@router.get("/allocation-data", response_model=AllocationData)
async def allocation_data(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await get_allocation_data(db, current_user.id)


@router.put("/bulk", response_model=BulkBudgetResponse)
async def bulk_save(
    data: BulkBudgetSave,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await save_bulk_allocation(db, current_user.id, data)


@router.get("/{budget_id}", response_model=BudgetRead)
async def get_budget_endpoint(
    budget_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    budget = await get_budget(db, current_user.id, budget_id)
    if not budget:
        raise HTTPException(status_code=404, detail="Budget not found")
    return budget


@router.patch("/{budget_id}", response_model=BudgetRead)
async def update_budget_endpoint(
    budget_id: uuid.UUID,
    data: BudgetUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    budget = await update_budget(db, current_user.id, budget_id, data)
    if not budget:
        raise HTTPException(status_code=404, detail="Budget not found")
    return budget


@router.delete("/{budget_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_budget_endpoint(
    budget_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    deleted = await delete_budget(db, current_user.id, budget_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Budget not found")
