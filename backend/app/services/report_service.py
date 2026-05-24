import uuid
from datetime import date, timedelta

from sqlalchemy import case, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from app.models.budget import Budget
from app.models.category import Category
from app.models.transaction import Transaction

from app.schemas.report import (
    BudgetVsActual,
    CategoryPeriodAmount,
    CategoryVendor,
    IncomeVsExpense,
    MonthlyComparison,
    SpendingByCategory,
    SpendingByCategoryOverTime,
    SpendingTrend,
    TopMerchant,
)


async def get_spending_by_category(
    db: AsyncSession,
    user_id: uuid.UUID,
    start_date: date,
    end_date: date,
) -> list[SpendingByCategory]:
    ParentCategory = aliased(Category)

    query = (
        select(
            Category.id,
            Category.name,
            func.coalesce(Category.color, "").label("color"),
            func.coalesce(Category.icon, "").label("icon"),
            Category.parent_id,
            ParentCategory.name.label("parent_name"),
            func.sum(func.abs(Transaction.amount)).label("total_amount"),
            func.count(Transaction.id).label("transaction_count"),
        )
        .outerjoin(Category, Transaction.category_id == Category.id)
        .outerjoin(ParentCategory, Category.parent_id == ParentCategory.id)
        .where(
            Transaction.user_id == user_id,
            Transaction.date >= start_date,
            Transaction.date <= end_date,
            Transaction.amount < 0,
            case(
                (Category.id.is_(None), True),
                else_=Category.is_income.is_(False),
            ),
        )
        .group_by(
            Category.id, Category.name, Category.color, Category.icon,
            Category.parent_id, ParentCategory.name,
        )
        .order_by(func.sum(func.abs(Transaction.amount)).desc())
    )

    result = await db.execute(query)
    rows = result.all()

    if not rows:
        return []

    grand_total = sum(float(row.total_amount) for row in rows)

    return [
        SpendingByCategory(
            category_id=row.id,
            parent_category_id=row.parent_id,
            parent_category_name=row.parent_name,
            category_name=row.name or "Uncategorized",
            category_color=row.color or "#9ca3af",
            category_icon=row.icon or "",
            total_amount=float(row.total_amount),
            transaction_count=row.transaction_count,
            percentage=round(float(row.total_amount) / grand_total * 100, 2)
            if grand_total > 0
            else 0,
        )
        for row in rows
    ]


def _period_key(txn_date: date, granularity: str) -> str:
    if granularity == "daily":
        return txn_date.isoformat()
    elif granularity == "weekly":
        iso = txn_date.isocalendar()
        return f"{iso[0]}-W{iso[1]:02d}"
    else:
        return f"{txn_date.year}-{txn_date.month:02d}"


async def get_spending_trends(
    db: AsyncSession,
    user_id: uuid.UUID,
    start_date: date,
    end_date: date,
    granularity: str = "monthly",
) -> list[SpendingTrend]:
    query = (
        select(Transaction.date, Transaction.amount)
        .outerjoin(Category, Transaction.category_id == Category.id)
        .where(
            Transaction.user_id == user_id,
            Transaction.date >= start_date,
            Transaction.date <= end_date,
            Transaction.amount < 0,
            case(
                (Category.id.is_(None), True),
                else_=Category.is_income.is_(False),
            ),
        )
        .order_by(Transaction.date)
    )

    result = await db.execute(query)
    rows = result.all()

    grouped: dict[str, dict] = {}
    for row in rows:
        period = _period_key(row.date, granularity)
        if period not in grouped:
            grouped[period] = {"total_amount": 0.0, "transaction_count": 0}
        grouped[period]["total_amount"] += abs(float(row.amount))
        grouped[period]["transaction_count"] += 1

    return [
        SpendingTrend(
            period=period,
            total_amount=round(data["total_amount"], 2),
            transaction_count=data["transaction_count"],
        )
        for period, data in sorted(grouped.items())
    ]


async def get_spending_by_category_over_time(
    db: AsyncSession,
    user_id: uuid.UUID,
    start_date: date,
    end_date: date,
    granularity: str = "monthly",
    category_ids: list[uuid.UUID] | None = None,
) -> list[SpendingByCategoryOverTime]:
    query = (
        select(
            Transaction.date,
            Transaction.amount,
            Category.id.label("cat_id"),
            Category.name.label("cat_name"),
            func.coalesce(Category.color, "").label("cat_color"),
            Category.parent_id.label("cat_parent_id"),
        )
        .outerjoin(Category, Transaction.category_id == Category.id)
        .where(
            Transaction.user_id == user_id,
            Transaction.date >= start_date,
            Transaction.date <= end_date,
            Transaction.amount < 0,
            case(
                (Category.id.is_(None), True),
                else_=Category.is_income.is_(False),
            ),
        )
        .order_by(Transaction.date)
    )

    if category_ids:
        query = query.where(Transaction.category_id.in_(category_ids))

    result = await db.execute(query)
    rows = result.all()

    grouped: dict[str, dict[str | None, dict]] = {}
    for row in rows:
        period = _period_key(row.date, granularity)
        if period not in grouped:
            grouped[period] = {}

        cat_key = str(row.cat_id) if row.cat_id else None
        if cat_key not in grouped[period]:
            grouped[period][cat_key] = {
                "category_id": row.cat_id,
                "parent_category_id": row.cat_parent_id,
                "category_name": row.cat_name or "Uncategorized",
                "category_color": row.cat_color or "#9ca3af",
                "amount": 0.0,
            }
        grouped[period][cat_key]["amount"] += abs(float(row.amount))

    return [
        SpendingByCategoryOverTime(
            period=period,
            categories=[
                CategoryPeriodAmount(
                    category_id=cat["category_id"],
                    parent_category_id=cat["parent_category_id"],
                    category_name=cat["category_name"],
                    category_color=cat["category_color"],
                    amount=round(cat["amount"], 2),
                )
                for cat in sorted(
                    cats.values(), key=lambda c: c["amount"], reverse=True
                )
            ],
            total=round(sum(c["amount"] for c in cats.values()), 2),
        )
        for period, cats in sorted(grouped.items())
    ]


async def get_budget_vs_actual(
    db: AsyncSession,
    user_id: uuid.UUID,
    start_date: date,
    end_date: date,
) -> list[BudgetVsActual]:
    budget_result = await db.execute(
        select(Budget).where(Budget.user_id == user_id, Budget.is_active.is_(True))
    )
    budgets = list(budget_result.scalars().all())

    if not budgets:
        return []

    results = []
    for budget in budgets:
        spend_result = await db.execute(
            select(func.coalesce(func.sum(func.abs(Transaction.amount)), 0)).where(
                Transaction.user_id == user_id,
                Transaction.category_id == budget.category_id,
                Transaction.date >= start_date,
                Transaction.date <= end_date,
                Transaction.amount < 0,
            )
        )
        actual = float(spend_result.scalar() or 0)
        budgeted = float(budget.amount)
        difference = budgeted - actual
        percentage_used = round(actual / budgeted * 100, 2) if budgeted > 0 else 0

        cat_result = await db.execute(
            select(
                Category.id, Category.name, Category.color, Category.parent_id,
            ).where(Category.id == budget.category_id)
        )
        cat_row = cat_result.one_or_none()
        cat_name = cat_row.name if cat_row else "Unknown"
        cat_color = (cat_row.color or "") if cat_row else ""

        parent_name = None
        if cat_row and cat_row.parent_id:
            parent_result = await db.execute(
                select(Category.name).where(Category.id == cat_row.parent_id)
            )
            parent_name = parent_result.scalar_one_or_none()

        results.append(
            BudgetVsActual(
                budget_id=budget.id,
                category_id=cat_row.id if cat_row else None,
                parent_category_id=cat_row.parent_id if cat_row else None,
                parent_category_name=parent_name,
                category_name=cat_name,
                category_color=cat_color,
                budgeted_amount=budgeted,
                actual_amount=actual,
                difference=round(difference, 2),
                percentage_used=percentage_used,
            )
        )

    return results


async def get_monthly_comparison(
    db: AsyncSession,
    user_id: uuid.UUID,
    months: int = 6,
) -> list[MonthlyComparison]:
    today = date.today()
    start_date = (today.replace(day=1) - timedelta(days=(months - 1) * 28)).replace(day=1)

    query = (
        select(Transaction.date, Transaction.amount, Category.is_income)
        .outerjoin(Category, Transaction.category_id == Category.id)
        .where(
            Transaction.user_id == user_id,
            Transaction.date >= start_date,
            Transaction.date <= today,
        )
        .order_by(Transaction.date)
    )

    result = await db.execute(query)
    rows = result.all()

    grouped: dict[str, dict] = {}
    for row in rows:
        month_key = f"{row.date.year}-{row.date.month:02d}"
        if month_key not in grouped:
            grouped[month_key] = {"income": 0.0, "expenses": 0.0}

        amount = float(row.amount)
        if amount > 0:
            grouped[month_key]["income"] += amount
        elif amount < 0:
            grouped[month_key]["expenses"] += abs(amount)

    return [
        MonthlyComparison(
            month=month,
            income=round(data["income"], 2),
            expenses=round(data["expenses"], 2),
            net=round(data["income"] - data["expenses"], 2),
        )
        for month, data in sorted(grouped.items())
    ]


async def get_income_vs_expense(
    db: AsyncSession,
    user_id: uuid.UUID,
    start_date: date,
    end_date: date,
    granularity: str = "monthly",
) -> list[IncomeVsExpense]:
    query = (
        select(Transaction.date, Transaction.amount, Category.is_income)
        .outerjoin(Category, Transaction.category_id == Category.id)
        .where(
            Transaction.user_id == user_id,
            Transaction.date >= start_date,
            Transaction.date <= end_date,
        )
        .order_by(Transaction.date)
    )

    result = await db.execute(query)
    rows = result.all()

    grouped: dict[str, dict] = {}
    for row in rows:
        period = _period_key(row.date, granularity)
        if period not in grouped:
            grouped[period] = {"income": 0.0, "expenses": 0.0}

        amount = float(row.amount)
        if amount > 0:
            grouped[period]["income"] += amount
        elif amount < 0:
            grouped[period]["expenses"] += abs(amount)

    return [
        IncomeVsExpense(
            period=period,
            income=round(data["income"], 2),
            expenses=round(data["expenses"], 2),
            savings_rate=round(
                (data["income"] - data["expenses"]) / data["income"] * 100, 2
            )
            if data["income"] > 0
            else 0,
        )
        for period, data in sorted(grouped.items())
    ]


_FIXED_RECURRING_CATEGORIES = [
    "bills & utilities",
    "housing",
    "mortgage",
    "rent",
    "car payment",
    "auto loan",
    "insurance",
    "savings",
    "investment",
    "investments",
    "transfer",
    "transfers",
    "loan payment",
    "debt payment",
]


async def get_top_merchants(
    db: AsyncSession,
    user_id: uuid.UUID,
    start_date: date,
    end_date: date,
    limit: int = 10,
) -> list[TopMerchant]:
    normalized = func.lower(func.trim(Transaction.description))

    ParentCategory = aliased(Category)

    query = (
        select(
            normalized.label("description"),
            func.sum(func.abs(Transaction.amount)).label("total_amount"),
            func.count(Transaction.id).label("transaction_count"),
        )
        .outerjoin(Category, Transaction.category_id == Category.id)
        .outerjoin(ParentCategory, Category.parent_id == ParentCategory.id)
        .where(
            Transaction.user_id == user_id,
            Transaction.date >= start_date,
            Transaction.date <= end_date,
            Transaction.amount < 0,
            case(
                (Category.id.is_(None), True),
                else_=Category.is_income.is_(False),
            ),
            # Exclude fixed/recurring categories by name or parent name
            case(
                (Category.id.is_(None), True),
                else_=~func.lower(Category.name).in_(_FIXED_RECURRING_CATEGORIES),
            ),
            case(
                (ParentCategory.id.is_(None), True),
                else_=~func.lower(ParentCategory.name).in_(
                    _FIXED_RECURRING_CATEGORIES
                ),
            ),
        )
        .group_by(normalized)
        .order_by(func.sum(func.abs(Transaction.amount)).desc())
        .limit(limit)
    )

    result = await db.execute(query)
    rows = result.all()

    return [
        TopMerchant(
            description=row.description,
            total_amount=float(row.total_amount),
            transaction_count=row.transaction_count,
        )
        for row in rows
    ]


async def get_category_vendors(
    db: AsyncSession,
    user_id: uuid.UUID,
    category_id: uuid.UUID,
    start_date: date,
    end_date: date,
    limit: int = 20,
) -> list[CategoryVendor]:
    normalized = func.lower(func.trim(Transaction.description))

    query = (
        select(
            normalized.label("description"),
            func.sum(func.abs(Transaction.amount)).label("total_amount"),
            func.count(Transaction.id).label("transaction_count"),
        )
        .outerjoin(Category, Transaction.category_id == Category.id)
        .where(
            Transaction.user_id == user_id,
            Transaction.date >= start_date,
            Transaction.date <= end_date,
            Transaction.amount < 0,
            or_(
                Transaction.category_id == category_id,
                Category.parent_id == category_id,
            ),
        )
        .group_by(normalized)
        .order_by(func.sum(func.abs(Transaction.amount)).desc())
        .limit(limit)
    )

    result = await db.execute(query)
    rows = result.all()

    if not rows:
        return []

    grand_total = sum(float(row.total_amount) for row in rows)

    return [
        CategoryVendor(
            description=row.description,
            total_amount=float(row.total_amount),
            transaction_count=row.transaction_count,
            percentage=round(float(row.total_amount) / grand_total * 100, 2)
            if grand_total > 0
            else 0,
        )
        for row in rows
    ]
