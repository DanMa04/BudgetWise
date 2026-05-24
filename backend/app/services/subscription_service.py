import re
import uuid
from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.category import Category
from app.models.transaction import Transaction

INTERVAL_RANGES = {
    "weekly": (5, 9),
    "biweekly": (12, 16),
    "monthly": (25, 35),
    "quarterly": (80, 100),
    "annual": (350, 380),
}

MIN_OCCURRENCES = 3


def _normalize_merchant(description: str) -> str:
    cleaned = description.strip().lower()
    # Strip trailing transaction-specific IDs (e.g., "AMAZON PRIME*MFG12345" → "amazon prime")
    cleaned = re.sub(r"\*.*$", "", cleaned)
    # Strip trailing reference/order numbers (e.g., "MERCHANT #12345")
    cleaned = re.sub(r"\s*#\d+\s*$", "", cleaned)
    return cleaned.strip()


def _detect_interval(dates: list[date]) -> tuple[str, float] | None:
    """Given sorted dates, detect if they follow a regular interval.

    Returns (period_name, avg_days) or None if no pattern found.
    """
    if len(dates) < MIN_OCCURRENCES:
        return None

    sorted_dates = sorted(dates)
    gaps = [
        (sorted_dates[i + 1] - sorted_dates[i]).days
        for i in range(len(sorted_dates) - 1)
    ]

    avg_gap = sum(gaps) / len(gaps)

    for period_name, (low, high) in INTERVAL_RANGES.items():
        if low <= avg_gap <= high:
            outliers = sum(1 for g in gaps if not (low - 3 <= g <= high + 3))
            if outliers / len(gaps) <= 0.25:
                return period_name, avg_gap

    return None


async def detect_subscriptions(
    db: AsyncSession,
    user_id: uuid.UUID,
    lookback_days: int = 365,
) -> list[dict]:
    """Scan transactions for recurring patterns that look like subscriptions.

    Groups by normalized merchant + exact amount, then checks for regular intervals.
    """
    cutoff = date.today() - timedelta(days=lookback_days)

    result = await db.execute(
        select(
            Transaction.description,
            Transaction.amount,
            Transaction.date,
            Transaction.id,
            Transaction.category_id,
            Transaction.category_source,
        )
        .where(
            Transaction.user_id == user_id,
            Transaction.date >= cutoff,
            Transaction.amount < 0,
        )
        .order_by(Transaction.description, Transaction.amount, Transaction.date)
    )
    rows = result.all()

    groups: dict[tuple[str, Decimal], list[dict]] = {}
    for row in rows:
        key = (_normalize_merchant(row.description), row.amount)
        if key not in groups:
            groups[key] = []
        groups[key].append({
            "id": row.id,
            "date": row.date,
            "category_id": row.category_id,
            "category_source": row.category_source,
        })

    subscriptions_cat = await db.execute(
        select(Category.id).where(
            Category.user_id == user_id,
            func.lower(Category.name) == "subscriptions",
        )
    )
    subscriptions_cat_id = subscriptions_cat.scalar_one_or_none()

    suggestions = []
    for (merchant, amount), txns in groups.items():
        if len(txns) < MIN_OCCURRENCES:
            continue

        dates = [t["date"] for t in txns]
        interval_result = _detect_interval(dates)
        if interval_result is None:
            continue

        period_name, avg_days = interval_result

        already_handled = all(
            t["category_source"] == "subscription" for t in txns
        )
        if already_handled:
            continue

        transaction_ids = [str(t["id"]) for t in txns]
        most_recent = max(dates)
        next_expected = most_recent + timedelta(days=round(avg_days))

        suggestions.append({
            "merchant": merchant,
            "amount": float(abs(amount)),
            "period": period_name,
            "avg_interval_days": round(avg_days, 1),
            "occurrence_count": len(txns),
            "first_seen": min(dates).isoformat(),
            "last_seen": most_recent.isoformat(),
            "next_expected": next_expected.isoformat(),
            "transaction_ids": transaction_ids,
            "subscription_category_id": str(subscriptions_cat_id) if subscriptions_cat_id else None,
        })

    suggestions.sort(key=lambda s: s["occurrence_count"], reverse=True)
    return suggestions


async def apply_subscription_suggestion(
    db: AsyncSession,
    user_id: uuid.UUID,
    transaction_ids: list[uuid.UUID],
    category_id: uuid.UUID,
    merchant_pattern: str,
    create_rule: bool = True,
) -> int:
    """Apply subscription category to matching transactions and optionally create a rule."""
    from app.models.categorization_rule import CategorizationRule

    count = 0
    for txn_id in transaction_ids:
        result = await db.execute(
            select(Transaction).where(
                Transaction.id == txn_id,
                Transaction.user_id == user_id,
            )
        )
        txn = result.scalar_one_or_none()
        if txn:
            txn.category_id = category_id
            txn.category_source = "subscription"
            txn.is_recurring = True
            count += 1

    if create_rule and len(merchant_pattern) >= 7:
        # Use starts_with so the rule only matches descriptions that begin with
        # this merchant name, not unrelated vendors that happen to contain the string.
        # Skip very short patterns (< 7 chars) to avoid overly broad rules.
        existing = await db.execute(
            select(CategorizationRule).where(
                CategorizationRule.user_id == user_id,
                CategorizationRule.pattern == merchant_pattern,
                CategorizationRule.category_id == category_id,
            )
        )
        if not existing.scalar_one_or_none():
            rule = CategorizationRule(
                user_id=user_id,
                category_id=category_id,
                rule_type="starts_with",
                pattern=merchant_pattern,
                priority=10,
                is_active=True,
                created_by="subscription",
            )
            db.add(rule)

    await db.flush()
    return count
