from datetime import date, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.report import (
    BudgetVsActual,
    IncomeVsExpense,
    MonthlyComparison,
    SpendingByCategory,
    SpendingTrend,
    TopMerchant,
)
from app.services.report_service import (
    get_budget_vs_actual,
    get_income_vs_expense,
    get_monthly_comparison,
    get_spending_by_category,
    get_spending_trends,
    get_top_merchants,
)

router = APIRouter(prefix="/reports", tags=["reports"])


def _default_date_range(
    start_date: date | None, end_date: date | None
) -> tuple[date, date]:
    if end_date is None:
        end_date = date.today()
    if start_date is None:
        start_date = end_date - timedelta(days=30)
    return start_date, end_date


@router.get("/spending-by-category", response_model=list[SpendingByCategory])
async def spending_by_category(
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    start, end = _default_date_range(start_date, end_date)
    return await get_spending_by_category(db, current_user.id, start, end)


@router.get("/spending-trends", response_model=list[SpendingTrend])
async def spending_trends(
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
    granularity: str = Query("monthly"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    start, end = _default_date_range(start_date, end_date)
    return await get_spending_trends(db, current_user.id, start, end, granularity)


@router.get("/budget-vs-actual", response_model=list[BudgetVsActual])
async def budget_vs_actual(
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    start, end = _default_date_range(start_date, end_date)
    return await get_budget_vs_actual(db, current_user.id, start, end)


@router.get("/monthly-comparison", response_model=list[MonthlyComparison])
async def monthly_comparison(
    months: int = Query(6),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await get_monthly_comparison(db, current_user.id, months)


@router.get("/income-vs-expense", response_model=list[IncomeVsExpense])
async def income_vs_expense(
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
    granularity: str = Query("monthly"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    start, end = _default_date_range(start_date, end_date)
    return await get_income_vs_expense(db, current_user.id, start, end, granularity)


@router.get("/top-merchants", response_model=list[TopMerchant])
async def top_merchants(
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
    limit: int = Query(10),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    start, end = _default_date_range(start_date, end_date)
    return await get_top_merchants(db, current_user.id, start, end, limit)
