import uuid

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.categorization_rule import CategorizationRule
from app.models.category import Category
from app.models.category_snapshot import CategorySnapshot
from app.models.transaction import Transaction
from app.models.transfer_rule import TransferRule

MAX_SNAPSHOTS = 3


async def create_snapshot(
    db: AsyncSession,
    user_id: uuid.UUID,
    name: str,
    trigger: str,
) -> CategorySnapshot:
    cats = (
        await db.execute(select(Category).where(Category.user_id == user_id))
    ).scalars().all()

    cat_rules = (
        await db.execute(
            select(CategorizationRule).where(CategorizationRule.user_id == user_id)
        )
    ).scalars().all()

    t_rules = (
        await db.execute(
            select(TransferRule).where(TransferRule.user_id == user_id)
        )
    ).scalars().all()

    txns = (
        await db.execute(
            select(Transaction.id, Transaction.category_id, Transaction.category_source)
            .where(Transaction.user_id == user_id, Transaction.category_id.isnot(None))
        )
    ).all()

    categories_data = [
        {
            "id": str(c.id),
            "parent_id": str(c.parent_id) if c.parent_id else None,
            "name": c.name,
            "icon": c.icon,
            "color": c.color,
            "is_system": c.is_system,
            "is_income": c.is_income,
            "sort_order": c.sort_order,
        }
        for c in cats
    ]

    rules_data = [
        {
            "id": str(r.id),
            "category_id": str(r.category_id),
            "rule_type": r.rule_type,
            "pattern": r.pattern,
            "priority": r.priority,
            "is_active": r.is_active,
            "created_by": r.created_by,
        }
        for r in cat_rules
    ]

    transfer_rules_data = [
        {
            "id": str(r.id),
            "source_category_id": str(r.source_category_id),
            "target_category_id": str(r.target_category_id),
            "name": r.name,
            "amount_exact": float(r.amount_exact) if r.amount_exact is not None else None,
            "amount_min": float(r.amount_min) if r.amount_min is not None else None,
            "amount_max": float(r.amount_max) if r.amount_max is not None else None,
            "day_of_month": r.day_of_month,
            "day_tolerance": r.day_tolerance,
            "counterparty_pattern": r.counterparty_pattern,
            "is_active": r.is_active,
            "priority": r.priority,
        }
        for r in t_rules
    ]

    txn_assignments = [
        {
            "id": str(t.id),
            "category_id": str(t.category_id),
            "category_source": t.category_source,
        }
        for t in txns
    ]

    snapshot = CategorySnapshot(
        user_id=user_id,
        name=name,
        trigger=trigger,
        categories={"items": categories_data},
        categorization_rules={"items": rules_data},
        transfer_rules={"items": transfer_rules_data},
        transaction_assignments={"items": txn_assignments},
        category_count=len(categories_data),
        rule_count=len(rules_data) + len(transfer_rules_data),
    )
    db.add(snapshot)
    await db.flush()

    await _enforce_limit(db, user_id)
    return snapshot


async def _enforce_limit(db: AsyncSession, user_id: uuid.UUID) -> None:
    count_result = await db.execute(
        select(func.count())
        .select_from(CategorySnapshot)
        .where(CategorySnapshot.user_id == user_id)
    )
    count = count_result.scalar() or 0

    if count > MAX_SNAPSHOTS:
        oldest = (
            await db.execute(
                select(CategorySnapshot.id)
                .where(CategorySnapshot.user_id == user_id)
                .order_by(CategorySnapshot.created_at.asc())
                .limit(count - MAX_SNAPSHOTS)
            )
        ).scalars().all()

        if oldest:
            await db.execute(
                delete(CategorySnapshot).where(CategorySnapshot.id.in_(oldest))
            )


async def list_snapshots(
    db: AsyncSession, user_id: uuid.UUID
) -> list[CategorySnapshot]:
    result = await db.execute(
        select(CategorySnapshot)
        .where(CategorySnapshot.user_id == user_id)
        .order_by(CategorySnapshot.created_at.desc())
    )
    return list(result.scalars().all())


async def get_snapshot(
    db: AsyncSession, user_id: uuid.UUID, snapshot_id: uuid.UUID
) -> CategorySnapshot | None:
    result = await db.execute(
        select(CategorySnapshot).where(
            CategorySnapshot.id == snapshot_id,
            CategorySnapshot.user_id == user_id,
        )
    )
    return result.scalar_one_or_none()


async def delete_snapshot(
    db: AsyncSession, user_id: uuid.UUID, snapshot_id: uuid.UUID
) -> bool:
    snapshot = await get_snapshot(db, user_id, snapshot_id)
    if not snapshot:
        return False
    await db.delete(snapshot)
    await db.flush()
    return True


async def restore_snapshot(
    db: AsyncSession, user_id: uuid.UUID, snapshot_id: uuid.UUID
) -> dict:
    snapshot = await get_snapshot(db, user_id, snapshot_id)
    if not snapshot:
        raise ValueError("Snapshot not found")

    # Take a safety snapshot before restoring
    await create_snapshot(db, user_id, "Auto-save before restore", "pre_restore")

    # 1. Delete existing categorization rules and transfer rules
    await db.execute(
        delete(CategorizationRule).where(CategorizationRule.user_id == user_id)
    )
    await db.execute(
        delete(TransferRule).where(TransferRule.user_id == user_id)
    )

    # 2. Clear all transaction category assignments
    txns = (
        await db.execute(
            select(Transaction).where(Transaction.user_id == user_id)
        )
    ).scalars().all()
    txn_map = {str(t.id): t for t in txns}

    for t in txns:
        t.category_id = None
        t.category_source = None
        t.category_confidence = None

    # 3. Delete existing categories (children first to avoid FK issues)
    existing_cats = (
        await db.execute(
            select(Category).where(Category.user_id == user_id)
        )
    ).scalars().all()

    for c in existing_cats:
        c.parent_id = None
    await db.flush()

    for c in existing_cats:
        await db.delete(c)
    await db.flush()

    # 4. Recreate categories (without parent_id first)
    snap_cats = snapshot.categories.get("items", [])
    old_to_new: dict[str, uuid.UUID] = {}

    for cat_data in snap_cats:
        new_cat = Category(
            user_id=user_id,
            name=cat_data["name"],
            icon=cat_data.get("icon"),
            color=cat_data.get("color"),
            is_system=cat_data.get("is_system", False),
            is_income=cat_data.get("is_income", False),
            sort_order=cat_data.get("sort_order", 0),
        )
        db.add(new_cat)
        await db.flush()
        old_to_new[cat_data["id"]] = new_cat.id

    # 5. Set parent_id relationships
    for cat_data in snap_cats:
        if cat_data.get("parent_id") and cat_data["parent_id"] in old_to_new:
            new_id = old_to_new[cat_data["id"]]
            new_parent_id = old_to_new[cat_data["parent_id"]]
            cat = await db.get(Category, new_id)
            if cat:
                cat.parent_id = new_parent_id
    await db.flush()

    # 6. Recreate categorization rules
    snap_rules = snapshot.categorization_rules.get("items", [])
    rules_restored = 0
    for rule_data in snap_rules:
        old_cat_id = rule_data["category_id"]
        if old_cat_id not in old_to_new:
            continue
        new_rule = CategorizationRule(
            user_id=user_id,
            category_id=old_to_new[old_cat_id],
            rule_type=rule_data["rule_type"],
            pattern=rule_data["pattern"],
            priority=rule_data.get("priority", 0),
            is_active=rule_data.get("is_active", True),
            created_by=rule_data.get("created_by", "snapshot"),
        )
        db.add(new_rule)
        rules_restored += 1
    await db.flush()

    # 7. Recreate transfer rules
    snap_transfer = snapshot.transfer_rules.get("items", [])
    transfer_restored = 0
    for tr_data in snap_transfer:
        src = tr_data["source_category_id"]
        tgt = tr_data["target_category_id"]
        if src not in old_to_new or tgt not in old_to_new:
            continue
        new_tr = TransferRule(
            user_id=user_id,
            source_category_id=old_to_new[src],
            target_category_id=old_to_new[tgt],
            name=tr_data["name"],
            amount_exact=tr_data.get("amount_exact"),
            amount_min=tr_data.get("amount_min"),
            amount_max=tr_data.get("amount_max"),
            day_of_month=tr_data.get("day_of_month"),
            day_tolerance=tr_data.get("day_tolerance", 2),
            counterparty_pattern=tr_data.get("counterparty_pattern"),
            is_active=tr_data.get("is_active", True),
            priority=tr_data.get("priority", 0),
        )
        db.add(new_tr)
        transfer_restored += 1
    await db.flush()

    # 8. Restore transaction assignments
    snap_txns = snapshot.transaction_assignments.get("items", [])
    txns_updated = 0
    for ta in snap_txns:
        txn = txn_map.get(ta["id"])
        old_cat = ta["category_id"]
        if txn and old_cat in old_to_new:
            txn.category_id = old_to_new[old_cat]
            txn.category_source = ta.get("category_source")
            txns_updated += 1
    await db.flush()

    return {
        "categories_restored": len(old_to_new),
        "rules_restored": rules_restored,
        "transfer_rules_restored": transfer_restored,
        "transactions_updated": txns_updated,
    }
