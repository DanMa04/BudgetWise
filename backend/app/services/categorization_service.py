import re
import uuid
from pathlib import Path

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.ml.categorizer import MODELS_DIR, TransactionCategorizer
from app.models.categorization_rule import CategorizationRule
from app.models.transaction import Transaction
from app.schemas.categorization_rule import RuleCreate, RuleUpdate

MIN_TRAINING_SAMPLES = 50
RETRAIN_THRESHOLD = 20


def _model_path(user_id: uuid.UUID) -> str:
    return str(MODELS_DIR / f"{user_id}.joblib")


def _load_model(user_id: uuid.UUID) -> TransactionCategorizer | None:
    path = _model_path(user_id)
    if Path(path).exists():
        return TransactionCategorizer.load(path, user_id)
    return None


async def categorize_transaction(
    db: AsyncSession, user_id: uuid.UUID, description: str
) -> tuple[uuid.UUID | None, float, str]:
    rule_category = await apply_rules(db, user_id, description)
    if rule_category:
        return rule_category, 1.0, "rule"

    model = _load_model(user_id)
    if model:
        category_id, confidence = model.predict(description)
        if category_id:
            return category_id, confidence, "ml"
        return None, confidence, "ml"

    return None, 0.0, "ml"


async def apply_rules(
    db: AsyncSession, user_id: uuid.UUID, description: str
) -> uuid.UUID | None:
    result = await db.execute(
        select(CategorizationRule)
        .where(
            CategorizationRule.user_id == user_id,
            CategorizationRule.is_active.is_(True),
        )
        .order_by(CategorizationRule.priority.desc())
    )
    rules = list(result.scalars().all())

    type_order = ["exact", "merchant", "starts_with", "contains", "regex"]
    rules.sort(key=lambda r: (-(r.priority), type_order.index(r.rule_type)
                               if r.rule_type in type_order else 99))

    desc_lower = description.lower().strip()

    for rule in rules:
        matched = False
        pattern_lower = rule.pattern.lower()

        if rule.rule_type == "exact":
            matched = desc_lower == pattern_lower
        elif rule.rule_type == "merchant":
            cleaned = TransactionCategorizer.clean_description(description)
            matched = pattern_lower in cleaned
        elif rule.rule_type == "starts_with":
            matched = desc_lower.startswith(pattern_lower)
        elif rule.rule_type == "contains":
            matched = pattern_lower in desc_lower
        elif rule.rule_type == "regex":
            try:
                matched = bool(re.search(rule.pattern, description, re.IGNORECASE))
            except re.error:
                continue

        if matched:
            rule.match_count += 1
            await db.flush()
            return rule.category_id

    return None


async def record_correction(
    db: AsyncSession,
    user_id: uuid.UUID,
    transaction_id: uuid.UUID,
    new_category_id: uuid.UUID,
    create_rule: bool = False,
) -> None:
    result = await db.execute(
        select(Transaction).where(
            Transaction.id == transaction_id, Transaction.user_id == user_id
        )
    )
    transaction = result.scalar_one_or_none()
    if not transaction:
        return

    transaction.category_id = new_category_id
    transaction.category_source = "manual"
    transaction.category_confidence = 1.0

    if create_rule:
        rule = CategorizationRule(
            user_id=user_id,
            category_id=new_category_id,
            rule_type="merchant",
            pattern=TransactionCategorizer.clean_description(transaction.description),
            priority=10,
            created_by="user",
        )
        db.add(rule)

    await db.flush()

    # Check if retrain threshold reached
    count_result = await db.execute(
        select(Transaction)
        .where(
            Transaction.user_id == user_id,
            Transaction.category_source == "manual",
        )
    )
    manual_count = len(list(count_result.scalars().all()))
    if manual_count >= MIN_TRAINING_SAMPLES and manual_count % RETRAIN_THRESHOLD == 0:
        await train_user_model(db, user_id)


async def train_user_model(db: AsyncSession, user_id: uuid.UUID) -> bool:
    result = await db.execute(
        select(Transaction).where(
            Transaction.user_id == user_id,
            Transaction.category_id.isnot(None),
            Transaction.category_source == "manual",
        )
    )
    transactions = list(result.scalars().all())

    if len(transactions) < MIN_TRAINING_SAMPLES:
        return False

    descriptions = [t.description for t in transactions]
    category_ids = [t.category_id for t in transactions]

    categorizer = TransactionCategorizer(user_id)
    categorizer.train(descriptions, category_ids)
    categorizer.save(_model_path(user_id))

    return True


async def categorize_batch(
    db: AsyncSession, user_id: uuid.UUID, transactions: list[dict]
) -> list[dict]:
    model = _load_model(user_id)
    results = []

    for txn in transactions:
        description = txn["description"]

        rule_category = await apply_rules(db, user_id, description)
        if rule_category:
            txn["category_id"] = rule_category
            txn["category_confidence"] = 1.0
            txn["category_source"] = "rule"
            results.append(txn)
            continue

        if model:
            category_id, confidence = model.predict(description)
            txn["category_id"] = category_id
            txn["category_confidence"] = confidence
            txn["category_source"] = "ml"
        else:
            txn["category_id"] = None
            txn["category_confidence"] = 0.0
            txn["category_source"] = "ml"
        results.append(txn)

    return results


async def get_rules(
    db: AsyncSession, user_id: uuid.UUID, category_id: uuid.UUID | None = None
) -> list[CategorizationRule]:
    query = select(CategorizationRule).where(CategorizationRule.user_id == user_id)
    if category_id:
        query = query.where(CategorizationRule.category_id == category_id)
    query = query.order_by(CategorizationRule.priority.desc())
    result = await db.execute(query)
    return list(result.scalars().all())


async def create_rule(
    db: AsyncSession, user_id: uuid.UUID, data: RuleCreate
) -> CategorizationRule:
    rule = CategorizationRule(
        user_id=user_id,
        **data.model_dump(),
    )
    db.add(rule)
    await db.flush()
    await db.refresh(rule)
    return rule


async def update_rule(
    db: AsyncSession, user_id: uuid.UUID, rule_id: uuid.UUID, data: RuleUpdate
) -> CategorizationRule | None:
    result = await db.execute(
        select(CategorizationRule).where(
            CategorizationRule.id == rule_id, CategorizationRule.user_id == user_id
        )
    )
    rule = result.scalar_one_or_none()
    if not rule:
        return None
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(rule, key, value)
    await db.flush()
    await db.refresh(rule)
    return rule


async def delete_rule(
    db: AsyncSession, user_id: uuid.UUID, rule_id: uuid.UUID
) -> bool:
    result = await db.execute(
        select(CategorizationRule).where(
            CategorizationRule.id == rule_id, CategorizationRule.user_id == user_id
        )
    )
    rule = result.scalar_one_or_none()
    if not rule:
        return False
    await db.delete(rule)
    await db.flush()
    return True


async def bulk_categorize_transactions(
    db: AsyncSession,
    user_id: uuid.UUID,
    transaction_ids: list[uuid.UUID],
    category_id: uuid.UUID,
) -> int:
    result = await db.execute(
        update(Transaction)
        .where(
            Transaction.id.in_(transaction_ids),
            Transaction.user_id == user_id,
        )
        .values(
            category_id=category_id,
            category_source="manual",
            category_confidence=1.0,
        )
    )
    await db.flush()
    return result.rowcount


# Merchant keywords → category name mapping for default rule seeding
DEFAULT_RULES: list[tuple[str, str, str]] = [
    # (pattern, rule_type, category_name)
    # Groceries
    ("walmart", "contains", "Groceries"),
    ("kroger", "contains", "Groceries"),
    ("trader joe", "contains", "Groceries"),
    ("whole foods", "contains", "Groceries"),
    ("aldi", "contains", "Groceries"),
    ("costco", "contains", "Groceries"),
    ("safeway", "contains", "Groceries"),
    ("publix", "contains", "Groceries"),
    ("heb", "contains", "Groceries"),
    ("wegmans", "contains", "Groceries"),
    ("sprouts", "contains", "Groceries"),
    # Dining Out
    ("mcdonald", "contains", "Dining Out"),
    ("starbucks", "contains", "Dining Out"),
    ("chipotle", "contains", "Dining Out"),
    ("chick-fil-a", "contains", "Dining Out"),
    ("subway", "contains", "Dining Out"),
    ("doordash", "contains", "Dining Out"),
    ("uber eats", "contains", "Dining Out"),
    ("grubhub", "contains", "Dining Out"),
    ("dunkin", "contains", "Dining Out"),
    ("panera", "contains", "Dining Out"),
    ("taco bell", "contains", "Dining Out"),
    ("wendy", "contains", "Dining Out"),
    ("pizza hut", "contains", "Dining Out"),
    ("domino", "contains", "Dining Out"),
    # Transportation
    ("shell", "contains", "Transportation"),
    ("exxon", "contains", "Transportation"),
    ("chevron", "contains", "Transportation"),
    ("bp ", "contains", "Transportation"),
    ("uber", "starts_with", "Transportation"),
    ("lyft", "contains", "Transportation"),
    ("parking", "contains", "Transportation"),
    ("gas station", "contains", "Transportation"),
    ("speedway", "contains", "Transportation"),
    # Shopping
    ("amazon", "contains", "Shopping"),
    ("target", "contains", "Shopping"),
    ("best buy", "contains", "Shopping"),
    ("home depot", "contains", "Shopping"),
    ("lowe", "contains", "Shopping"),
    ("ikea", "contains", "Shopping"),
    ("macy", "contains", "Shopping"),
    ("nordstrom", "contains", "Shopping"),
    ("tj maxx", "contains", "Shopping"),
    ("marshalls", "contains", "Shopping"),
    ("ross", "contains", "Shopping"),
    # Subscriptions
    ("netflix", "contains", "Subscriptions"),
    ("spotify", "contains", "Subscriptions"),
    ("hulu", "contains", "Subscriptions"),
    ("disney+", "contains", "Subscriptions"),
    ("apple.com/bill", "contains", "Subscriptions"),
    ("youtube premium", "contains", "Subscriptions"),
    ("amazon prime", "contains", "Subscriptions"),
    ("hbo max", "contains", "Subscriptions"),
    ("adobe", "contains", "Subscriptions"),
    # Utilities
    ("electric", "contains", "Utilities"),
    ("water bill", "contains", "Utilities"),
    ("gas bill", "contains", "Utilities"),
    ("internet", "contains", "Utilities"),
    ("comcast", "contains", "Utilities"),
    ("at&t", "contains", "Utilities"),
    ("verizon", "contains", "Utilities"),
    ("t-mobile", "contains", "Utilities"),
    # Healthcare
    ("pharmacy", "contains", "Healthcare"),
    ("cvs", "contains", "Healthcare"),
    ("walgreens", "contains", "Healthcare"),
    ("doctor", "contains", "Healthcare"),
    ("hospital", "contains", "Healthcare"),
    ("dental", "contains", "Healthcare"),
    ("medical", "contains", "Healthcare"),
    # Entertainment
    ("movie", "contains", "Entertainment"),
    ("cinema", "contains", "Entertainment"),
    ("amc", "contains", "Entertainment"),
    ("regal", "contains", "Entertainment"),
    ("concert", "contains", "Entertainment"),
    ("ticketmaster", "contains", "Entertainment"),
    # Housing
    ("rent", "starts_with", "Housing"),
    ("mortgage", "contains", "Housing"),
    # Insurance
    ("insurance", "contains", "Insurance"),
    ("geico", "contains", "Insurance"),
    ("state farm", "contains", "Insurance"),
    ("allstate", "contains", "Insurance"),
    ("progressive", "contains", "Insurance"),
    # Travel
    ("airline", "contains", "Travel"),
    ("hotel", "contains", "Travel"),
    ("airbnb", "contains", "Travel"),
    ("marriott", "contains", "Travel"),
    ("hilton", "contains", "Travel"),
    ("expedia", "contains", "Travel"),
    ("delta air", "contains", "Travel"),
    ("united air", "contains", "Travel"),
    ("southwest", "contains", "Travel"),
    # Personal Care
    ("salon", "contains", "Personal Care"),
    ("barber", "contains", "Personal Care"),
    ("spa", "contains", "Personal Care"),
    # Income
    ("payroll", "contains", "Salary"),
    ("direct deposit", "contains", "Salary"),
    ("salary", "contains", "Salary"),
    ("dividend", "contains", "Investments"),
    ("interest payment", "contains", "Investments"),
]


async def seed_default_rules(db: AsyncSession, user_id: uuid.UUID) -> None:
    """Create default categorization rules for a new user based on common merchants."""
    from app.models.category import Category

    result = await db.execute(
        select(Category).where(Category.user_id == user_id)
    )
    categories = {c.name.lower(): c.id for c in result.scalars().all()}

    for pattern, rule_type, category_name in DEFAULT_RULES:
        cat_id = categories.get(category_name.lower())
        if not cat_id:
            continue
        rule = CategorizationRule(
            user_id=user_id,
            category_id=cat_id,
            rule_type=rule_type,
            pattern=pattern,
            priority=5,
            created_by="system",
        )
        db.add(rule)

    await db.flush()
