import uuid

from sqlalchemy import delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.budget import Budget
from app.models.categorization_rule import CategorizationRule
from app.models.category import Category
from app.models.transaction import Transaction
from app.schemas.category import (
    CategoryRead,
    CategoryWithSpend,
    MergeCategoryResponse,
    MergeSuggestion,
)
from app.services.import_service import _normalize_category_name


async def merge_categories(
    db: AsyncSession,
    user_id: uuid.UUID,
    source_id: uuid.UUID,
    target_id: uuid.UUID,
) -> MergeCategoryResponse:
    if source_id == target_id:
        raise ValueError("Cannot merge a category into itself")

    source_result = await db.execute(
        select(Category).where(Category.id == source_id, Category.user_id == user_id)
    )
    source = source_result.scalar_one_or_none()
    if not source:
        raise ValueError("Source category not found")

    target_result = await db.execute(
        select(Category).where(Category.id == target_id, Category.user_id == user_id)
    )
    target = target_result.scalar_one_or_none()
    if not target:
        raise ValueError("Target category not found")

    if source.is_income != target.is_income:
        raise ValueError("Cannot merge income and expense categories")

    # Depth safety: if source has children and target is itself a child,
    # reparenting source's children to target would create a 3-level hierarchy
    source_children = await db.execute(
        select(Category.id).where(
            Category.parent_id == source_id, Category.user_id == user_id
        )
    )
    if source_children.scalars().first() and target.parent_id is not None:
        raise ValueError(
            "Cannot merge: source has children and target is a child category (would exceed 2-level limit)"
        )

    # Move transactions
    tx_result = await db.execute(
        update(Transaction)
        .where(Transaction.category_id == source_id, Transaction.user_id == user_id)
        .values(category_id=target_id)
    )
    transactions_moved = tx_result.rowcount

    # Move categorization rules
    rules_result = await db.execute(
        update(CategorizationRule)
        .where(
            CategorizationRule.category_id == source_id,
            CategorizationRule.user_id == user_id,
        )
        .values(category_id=target_id)
    )
    rules_moved = rules_result.rowcount

    # Handle budgets — respect unique constraint (user_id, category_id, period_type)
    source_budgets_result = await db.execute(
        select(Budget).where(
            Budget.category_id == source_id, Budget.user_id == user_id
        )
    )
    source_budgets = list(source_budgets_result.scalars().all())

    target_budgets_result = await db.execute(
        select(Budget).where(
            Budget.category_id == target_id, Budget.user_id == user_id
        )
    )
    target_budgets_by_period = {
        b.period_type: b for b in target_budgets_result.scalars().all()
    }

    budgets_merged = 0
    for sb in source_budgets:
        existing = target_budgets_by_period.get(sb.period_type)
        if existing:
            existing.amount = existing.amount + sb.amount
            await db.delete(sb)
        else:
            sb.category_id = target_id
        budgets_merged += 1

    # Reparent child categories
    await db.execute(
        update(Category)
        .where(Category.parent_id == source_id, Category.user_id == user_id)
        .values(parent_id=target_id)
    )

    # Delete source category
    await db.delete(source)
    await db.flush()

    return MergeCategoryResponse(
        target_id=target_id,
        transactions_moved=transactions_moved,
        rules_moved=rules_moved,
        budgets_merged=budgets_merged,
    )


async def get_merge_suggestions(
    db: AsyncSession, user_id: uuid.UUID
) -> list[MergeSuggestion]:
    result = await db.execute(
        select(Category).where(
            Category.user_id == user_id, Category.is_income.is_(False)
        )
    )
    categories = list(result.scalars().all())

    # Count transactions per category for tiebreaking
    tx_counts_result = await db.execute(
        select(Transaction.category_id, func.count(Transaction.id))
        .where(Transaction.user_id == user_id, Transaction.category_id.isnot(None))
        .group_by(Transaction.category_id)
    )
    tx_counts: dict[uuid.UUID, int] = dict(tx_counts_result.all())

    normalized = {
        cat.id: _normalize_category_name(cat.name) for cat in categories
    }
    cat_by_id = {cat.id: cat for cat in categories}

    seen_pairs: set[tuple[uuid.UUID, uuid.UUID]] = set()
    suggestions: list[MergeSuggestion] = []

    for i, cat_a in enumerate(categories):
        tokens_a = set(normalized[cat_a.id].split())
        if not tokens_a:
            continue
        for cat_b in categories[i + 1 :]:
            tokens_b = set(normalized[cat_b.id].split())
            if not tokens_b:
                continue

            overlap = len(tokens_a & tokens_b)
            score = (2 * overlap) / (len(tokens_a) + len(tokens_b))
            if score < 0.5:
                continue

            # Skip parent-child pairs
            if cat_a.parent_id == cat_b.id or cat_b.parent_id == cat_a.id:
                continue

            # Determine source (to be deleted) vs target (to keep)
            # System categories can only be targets
            if cat_a.is_system and cat_b.is_system:
                continue
            if cat_a.is_system:
                source, target = cat_b, cat_a
            elif cat_b.is_system:
                source, target = cat_a, cat_b
            else:
                count_a = tx_counts.get(cat_a.id, 0)
                count_b = tx_counts.get(cat_b.id, 0)
                if count_a <= count_b:
                    source, target = cat_a, cat_b
                else:
                    source, target = cat_b, cat_a

            pair_key = (
                min(source.id, target.id),
                max(source.id, target.id),
            )
            if pair_key in seen_pairs:
                continue
            seen_pairs.add(pair_key)

            suggestions.append(
                MergeSuggestion(
                    source=CategoryRead.model_validate(source),
                    target=CategoryRead.model_validate(target),
                    similarity_score=round(score, 2),
                )
            )

    suggestions.sort(key=lambda s: s.similarity_score, reverse=True)
    return suggestions


async def get_categories_with_spend(
    db: AsyncSession, user_id: uuid.UUID
) -> list[CategoryWithSpend]:
    stmt = (
        select(
            Category,
            func.coalesce(func.sum(func.abs(Transaction.amount)), 0).label(
                "total_spend"
            ),
            func.count(Transaction.id).label("transaction_count"),
        )
        .outerjoin(
            Transaction,
            (Transaction.category_id == Category.id)
            & (Transaction.amount < 0),
        )
        .where(Category.user_id == user_id)
        .group_by(Category.id)
        .order_by(Category.sort_order, Category.name)
    )
    result = await db.execute(stmt)
    rows = result.all()

    return [
        CategoryWithSpend(
            **CategoryRead.model_validate(cat).model_dump(),
            total_spend=float(total_spend),
            transaction_count=int(tx_count),
        )
        for cat, total_spend, tx_count in rows
    ]
