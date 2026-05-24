import uuid
from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.account import Account
from app.models.budget import Budget
from app.models.category import Category
from app.models.goal import Goal
from app.models.transaction import Transaction
from app.models.user import User
from app.services.projection_service import resolve_return_rate
from app.schemas.budget import (
    AllocationData,
    BudgetCreate,
    BudgetRead,
    BudgetSummary,
    BudgetUpdate,
    BudgetWithSpend,
    BulkBudgetResponse,
    BulkBudgetSave,
    CategoryAllocation,
    GoalAllocation,
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


async def get_allocation_data(
    db: AsyncSession, user_id: uuid.UUID
) -> AllocationData:
    today = date.today()
    three_months_ago = today.replace(day=1) - timedelta(days=90)

    # Suggested monthly income: average of positive transactions over last 3 full months
    income_result = await db.execute(
        select(func.coalesce(func.sum(Transaction.amount), 0)).where(
            Transaction.user_id == user_id,
            Transaction.amount > 0,
            Transaction.date >= three_months_ago,
            Transaction.date <= today,
        )
    )
    total_income = float(income_result.scalar() or 0)
    months_span = max(
        1, ((today.year - three_months_ago.year) * 12 + today.month - three_months_ago.month)
    )
    suggested_monthly_income = round(total_income / months_span, 2)

    # User's override
    user_result = await db.execute(select(User).where(User.id == user_id))
    user = user_result.scalar_one()
    monthly_income_override = (
        float(user.monthly_income_override) if user.monthly_income_override else None
    )

    # Expense categories with existing budgets and average monthly spend
    categories_result = await db.execute(
        select(Category).where(
            Category.user_id == user_id,
            Category.is_income.is_(False),
        ).order_by(Category.sort_order, Category.name)
    )
    categories = list(categories_result.scalars().all())

    # Existing monthly budgets keyed by category_id
    budgets_result = await db.execute(
        select(Budget).where(
            Budget.user_id == user_id,
            Budget.period_type == "monthly",
            Budget.is_active.is_(True),
        )
    )
    budgets_by_cat: dict[uuid.UUID, Budget] = {
        b.category_id: b for b in budgets_result.scalars().all()
    }

    # Average monthly spend per category (expenses are negative, use abs)
    avg_spend_result = await db.execute(
        select(
            Transaction.category_id,
            func.abs(func.sum(Transaction.amount)).label("total_spend"),
        )
        .where(
            Transaction.user_id == user_id,
            Transaction.amount < 0,
            Transaction.date >= three_months_ago,
            Transaction.date <= today,
            Transaction.category_id.isnot(None),
        )
        .group_by(Transaction.category_id)
    )
    avg_spend_map: dict[uuid.UUID, float] = {}
    for row in avg_spend_result.all():
        avg_spend_map[row.category_id] = round(float(row.total_spend) / months_span, 2)

    category_allocations = []
    for cat in categories:
        budget = budgets_by_cat.get(cat.id)
        category_allocations.append(
            CategoryAllocation(
                category_id=cat.id,
                parent_id=cat.parent_id,
                category_name=cat.name,
                category_color=cat.color,
                category_icon=cat.icon,
                current_budget_amount=float(budget.amount) if budget else None,
                average_monthly_spend=avg_spend_map.get(cat.id, 0.0),
                is_locked=budget.is_locked if budget else False,
                budget_id=budget.id if budget else None,
            )
        )

    # Active goals with linked accounts
    goals_result = await db.execute(
        select(Goal).where(Goal.user_id == user_id, Goal.is_active.is_(True))
    )
    goals = list(goals_result.scalars().all())

    linked_account_ids = [g.linked_account_id for g in goals if g.linked_account_id]
    accounts_map: dict[uuid.UUID, Account] = {}
    if linked_account_ids:
        acct_result = await db.execute(
            select(Account).where(Account.id.in_(linked_account_ids))
        )
        accounts_map = {a.id: a for a in acct_result.scalars().all()}

    goal_allocations = []
    for goal in goals:
        remaining = float(goal.target_amount) - float(goal.current_amount)
        if goal.target_date and goal.target_date > today:
            months_left = max(
                1,
                (goal.target_date.year - today.year) * 12
                + goal.target_date.month - today.month,
            )
            monthly_rate = round(remaining / months_left, 2)
        else:
            monthly_rate = 0.0

        linked_acct = accounts_map.get(goal.linked_account_id) if goal.linked_account_id else None
        acct_rate: float | None = None
        if linked_acct:
            if linked_acct.account_type in ("loan", "credit"):
                acct_rate = float(linked_acct.interest_rate) if linked_acct.interest_rate else None
            elif linked_acct.account_type == "investment":
                resolved = resolve_return_rate(linked_acct.return_rate_preset, linked_acct.custom_return_rate)
                acct_rate = resolved if resolved > 0 else None

        goal_allocations.append(
            GoalAllocation(
                goal_id=goal.id,
                name=goal.name,
                color=goal.color,
                goal_type=goal.goal_type,
                target_amount=float(goal.target_amount),
                current_amount=float(goal.current_amount),
                monthly_rate=monthly_rate,
                planned_monthly_contribution=(
                    float(goal.planned_monthly_contribution)
                    if goal.planned_monthly_contribution
                    else None
                ),
                target_date=goal.target_date,
                linked_account_id=goal.linked_account_id,
                linked_account_type=linked_acct.account_type if linked_acct else None,
                linked_account_rate=acct_rate,
                linked_account_balance=float(linked_acct.current_balance) if linked_acct else None,
                linked_account_minimum_payment=(
                    float(linked_acct.minimum_payment)
                    if linked_acct and linked_acct.minimum_payment
                    else None
                ),
            )
        )

    return AllocationData(
        suggested_monthly_income=suggested_monthly_income,
        monthly_income_override=monthly_income_override,
        categories=category_allocations,
        goals=goal_allocations,
    )


async def save_bulk_allocation(
    db: AsyncSession, user_id: uuid.UUID, data: BulkBudgetSave
) -> BulkBudgetResponse:
    # Update user's monthly income override
    user_result = await db.execute(select(User).where(User.id == user_id))
    user = user_result.scalar_one()
    user.monthly_income_override = Decimal(str(data.monthly_income))

    # Get existing active monthly budgets
    existing_result = await db.execute(
        select(Budget).where(
            Budget.user_id == user_id,
            Budget.period_type == data.period_type,
            Budget.is_active.is_(True),
        )
    )
    existing_by_cat: dict[uuid.UUID, Budget] = {
        b.category_id: b for b in existing_result.scalars().all()
    }

    today = date.today()
    created = 0
    updated = 0
    allocation_cat_ids = {item.category_id for item in data.allocations}

    for item in data.allocations:
        existing = existing_by_cat.get(item.category_id)
        if existing:
            existing.amount = Decimal(str(item.amount))
            existing.is_locked = item.is_locked
            updated += 1
        else:
            # Need category name for the budget name
            cat_result = await db.execute(
                select(Category.name).where(Category.id == item.category_id)
            )
            cat_name = cat_result.scalar() or "Budget"
            new_budget = Budget(
                user_id=user_id,
                category_id=item.category_id,
                name=cat_name,
                amount=Decimal(str(item.amount)),
                period_type=data.period_type,
                start_date=today.replace(day=1),
                is_active=True,
                is_locked=item.is_locked,
            )
            db.add(new_budget)
            created += 1

    # Deactivate budgets not in the allocation list
    deactivated = 0
    for cat_id, budget in existing_by_cat.items():
        if cat_id not in allocation_cat_ids:
            budget.is_active = False
            deactivated += 1

    # Update goal contributions
    for gc in data.goal_contributions:
        goal_result = await db.execute(
            select(Goal).where(Goal.id == gc.goal_id, Goal.user_id == user_id)
        )
        goal = goal_result.scalar_one_or_none()
        if goal:
            goal.planned_monthly_contribution = Decimal(str(gc.monthly_amount))

    await db.flush()
    return BulkBudgetResponse(created=created, updated=updated, deactivated=deactivated)
