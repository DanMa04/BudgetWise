import uuid
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.budget import Budget
from app.models.category import Category
from app.models.transaction import Transaction
from app.schemas.extension import (
    BudgetCheckResponse,
    BudgetStatusItem,
    CartCheckResponse,
)
from app.services.budget_service import get_current_period


async def _get_budget_status_items(
    db: AsyncSession, user_id: uuid.UUID
) -> list[BudgetStatusItem]:
    """Return budget status items for all active budgets."""
    result = await db.execute(
        select(Budget).where(
            Budget.user_id == user_id,
            Budget.is_active.is_(True),
        )
    )
    budgets = list(result.scalars().all())

    items: list[BudgetStatusItem] = []
    for budget in budgets:
        period_start, period_end = get_current_period(budget)

        # Get category name
        cat_result = await db.execute(
            select(Category.name).where(Category.id == budget.category_id)
        )
        category_name = cat_result.scalar() or "Unknown"

        # Sum transactions in this category for the current period
        spend_result = await db.execute(
            select(func.coalesce(func.sum(Transaction.amount), 0)).where(
                Transaction.user_id == user_id,
                Transaction.category_id == budget.category_id,
                Transaction.date >= period_start,
                Transaction.date <= period_end,
                Transaction.amount > 0,
            )
        )
        spent = Decimal(str(spend_result.scalar() or 0))
        budgeted = budget.amount
        remaining = budgeted - spent
        percentage = (
            float(spent / budgeted * 100) if budgeted > 0 else 0.0
        )

        items.append(
            BudgetStatusItem(
                id=budget.id,
                name=budget.name,
                category_name=category_name,
                budgeted=budgeted,
                spent=spent,
                remaining=remaining,
                percentage_used=round(percentage, 2),
            )
        )

    return items


async def get_budget_status(
    db: AsyncSession, user_id: uuid.UUID
) -> BudgetCheckResponse:
    """Return all active budgets with current spend for the period."""
    items = await _get_budget_status_items(db, user_id)

    total_budgeted = sum(item.budgeted for item in items)
    total_spent = sum(item.spent for item in items)
    total_remaining = total_budgeted - total_spent

    return BudgetCheckResponse(
        total_budgeted=total_budgeted,
        total_spent=total_spent,
        total_remaining=total_remaining,
        budgets=items,
    )


async def check_cart_against_budgets(
    db: AsyncSession,
    user_id: uuid.UUID,
    cart_total: Decimal,
    merchant: str,
    site: str,
) -> CartCheckResponse:
    """Check if the cart total would push any budget over."""
    items = await _get_budget_status_items(db, user_id)

    total_remaining = sum(item.remaining for item in items)

    # Determine warning level
    if total_remaining > cart_total * 2:
        warning_level = "green"
    elif total_remaining > cart_total:
        warning_level = "yellow"
    else:
        warning_level = "red"

    can_afford = total_remaining >= cart_total

    # Build message
    if warning_level == "green":
        message = (
            f"You're in good shape! ${total_remaining:.2f} remaining "
            f"across your budgets after this ${cart_total:.2f} purchase."
        )
    elif warning_level == "yellow":
        message = (
            f"This ${cart_total:.2f} purchase is affordable but will leave "
            f"your budgets tight with ${total_remaining - cart_total:.2f} "
            f"remaining."
        )
    else:
        message = (
            f"This ${cart_total:.2f} purchase would exceed your remaining "
            f"budget of ${total_remaining:.2f}."
        )

    # Find affected budgets: ones where spend + cart_total would exceed budget
    affected = [
        item for item in items
        if item.spent + cart_total > item.budgeted
    ]

    return CartCheckResponse(
        can_afford=can_afford,
        cart_total=cart_total,
        total_remaining=total_remaining,
        warning_level=warning_level,
        message=message,
        affected_budgets=affected,
    )
