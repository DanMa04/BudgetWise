import uuid
from datetime import date, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.budget import Budget
from app.models.transaction import Transaction
from app.schemas.budget import (
    BudgetCreate,
    BudgetRead,
    BudgetSummary,
    BudgetUpdate,
    BudgetWithSpend,
)


def get_current_period(budget: Budget) -> tuple[date, date]:
    """Compute the current period start and end based on period_type and start_date."""
    today = date.today()
    start = budget.start_date

    if budget.period_type == "weekly":
        days_since_start = (today - start).days
        periods_elapsed = days_since_start // 7
        period_start = start + timedelta(weeks=periods_elapsed)
        period_end = period_start + timedelta(days=6)
    elif budget.period_type == "biweekly":
        days_since_start = (today - start).days
        periods_elapsed = days_since_start // 14
        period_start = start + timedelta(weeks=2 * periods_elapsed)
        period_end = period_start + timedelta(days=13)
    elif budget.period_type == "yearly":
        year_offset = today.year - start.year
        period_start = start.replace(year=start.year + year_offset)
        if period_start > today:
            period_start = start.replace(year=start.year + year_offset - 1)
        period_end = period_start.replace(year=period_start.year + 1) - timedelta(days=1)
    else:  # monthly (default)
        # Find the current month's period start
        month_offset = (today.year - start.year) * 12 + (today.month - start.month)
        year = start.year + (start.month - 1 + month_offset) // 12
        month = (start.month - 1 + month_offset) % 12 + 1
        day = min(start.day, _days_in_month(year, month))
        period_start = date(year, month, day)
        if period_start > today:
            month_offset -= 1
            year = start.year + (start.month - 1 + month_offset) // 12
            month = (start.month - 1 + month_offset) % 12 + 1
            day = min(start.day, _days_in_month(year, month))
            period_start = date(year, month, day)
        # Period end is the day before the next period start
        next_month_offset = month_offset + 1
        next_year = start.year + (start.month - 1 + next_month_offset) // 12
        next_month = (start.month - 1 + next_month_offset) % 12 + 1
        next_day = min(start.day, _days_in_month(next_year, next_month))
        period_end = date(next_year, next_month, next_day) - timedelta(days=1)

    return period_start, period_end


def _days_in_month(year: int, month: int) -> int:
    """Return the number of days in a given month."""
    if month == 12:
        return 31
    return (date(year, month + 1, 1) - timedelta(days=1)).day


async def create_budget(
    db: AsyncSession, user_id: uuid.UUID, data: BudgetCreate
) -> Budget:
    budget = Budget(
        user_id=user_id,
        **data.model_dump(),
    )
    db.add(budget)
    await db.flush()
    await db.refresh(budget)
    return budget


async def get_budget(
    db: AsyncSession, user_id: uuid.UUID, budget_id: uuid.UUID
) -> Budget | None:
    result = await db.execute(
        select(Budget).where(Budget.id == budget_id, Budget.user_id == user_id)
    )
    return result.scalar_one_or_none()


async def get_budgets_with_spend(
    db: AsyncSession, user_id: uuid.UUID
) -> list[BudgetWithSpend]:
    result = await db.execute(
        select(Budget).where(Budget.user_id == user_id, Budget.is_active.is_(True))
    )
    budgets = list(result.scalars().all())

    budgets_with_spend = []
    for budget in budgets:
        period_start, period_end = get_current_period(budget)

        # Sum transactions in this category for the current period
        # Negative amounts are expenses (banking convention)
        spend_result = await db.execute(
            select(func.coalesce(func.sum(func.abs(Transaction.amount)), 0)).where(
                Transaction.user_id == user_id,
                Transaction.category_id == budget.category_id,
                Transaction.date >= period_start,
                Transaction.date <= period_end,
                Transaction.amount < 0,
            )
        )
        spent = float(spend_result.scalar() or 0)
        budget_amount = float(budget.amount)
        remaining = budget_amount - spent
        percentage = (spent / budget_amount * 100) if budget_amount > 0 else 0

        budget_dict = BudgetRead.model_validate(budget).model_dump()
        budget_dict["spent_amount"] = spent
        budget_dict["remaining_amount"] = remaining
        budget_dict["percentage_used"] = round(percentage, 2)
        budgets_with_spend.append(BudgetWithSpend(**budget_dict))

    return budgets_with_spend


async def get_budget_summary(
    db: AsyncSession, user_id: uuid.UUID
) -> BudgetSummary:
    budgets_with_spend = await get_budgets_with_spend(db, user_id)
    total_budgeted = sum(float(b.amount) for b in budgets_with_spend)
    total_spent = sum(b.spent_amount for b in budgets_with_spend)
    total_remaining = total_budgeted - total_spent

    return BudgetSummary(
        total_budgeted=total_budgeted,
        total_spent=total_spent,
        total_remaining=total_remaining,
        budgets=budgets_with_spend,
    )


async def update_budget(
    db: AsyncSession, user_id: uuid.UUID, budget_id: uuid.UUID, data: BudgetUpdate
) -> Budget | None:
    budget = await get_budget(db, user_id, budget_id)
    if not budget:
        return None
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(budget, key, value)
    await db.flush()
    await db.refresh(budget)
    return budget


async def delete_budget(
    db: AsyncSession, user_id: uuid.UUID, budget_id: uuid.UUID
) -> bool:
    budget = await get_budget(db, user_id, budget_id)
    if not budget:
        return False
    await db.delete(budget)
    await db.flush()
    return True
