import re
import uuid
from datetime import date
from decimal import Decimal
from pathlib import Path

from sqlalchemy import delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.ml.categorizer import MODELS_DIR, TransactionCategorizer
from app.models.categorization_rule import CategorizationRule
from app.models.category import Category
from app.models.transaction import Transaction
from app.models.transfer_rule import TransferRule
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
    db: AsyncSession,
    user_id: uuid.UUID,
    description: str,
    amount: Decimal | None = None,
    txn_date: date | None = None,
) -> tuple[uuid.UUID | None, float, str]:
    rule_category = await apply_rules(db, user_id, description)
    if rule_category:
        if amount is not None and txn_date is not None:
            override = await apply_transfer_rules(
                db, user_id, rule_category, amount, txn_date, description
            )
            if override:
                return override, 1.0, "transfer_rule"
        return rule_category, 1.0, "rule"

    model = _load_model(user_id)
    if model:
        category_id, confidence = model.predict(description)
        if category_id:
            # Validate: the model may still hold IDs from categories the user
            # has since deleted (e.g. after wipe-data). A stale ID would
            # cause an FK violation on UPDATE, so verify before returning.
            exists = await db.scalar(
                select(Category.id).where(
                    Category.id == category_id,
                    Category.user_id == user_id,
                )
            )
            if not exists:
                return None, 0.0, "ml"
            if amount is not None and txn_date is not None:
                override = await apply_transfer_rules(
                    db, user_id, category_id, amount, txn_date, description
                )
                if override:
                    return override, 1.0, "transfer_rule"
            return category_id, confidence, "ml"
        return None, confidence, "ml"

    return None, 0.0, "ml"


async def apply_rules_to_uncategorized(
    db: AsyncSession, user_id: uuid.UUID
) -> int:
    """Apply existing active rules to every uncategorized transaction.

    Deterministic, idempotent, and rule-driven only (no ML, no AI). Returns
    the number of transactions that received a category. Used by the AI
    onboarding assistant to make sense of imports before the conversation.
    """
    result = await db.execute(
        select(Transaction).where(
            Transaction.user_id == user_id,
            Transaction.category_id.is_(None),
        )
    )
    uncategorized = list(result.scalars().all())
    if not uncategorized:
        return 0

    updated = 0
    for txn in uncategorized:
        cat_id = await apply_rules(db, user_id, txn.description)
        if cat_id:
            txn.category_id = cat_id
            txn.category_source = "rule"
            txn.category_confidence = 1.0
            updated += 1
    if updated:
        await db.flush()
    return updated


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

    cleaned_pattern = TransactionCategorizer.clean_description(transaction.description)

    if create_rule:
        rule = CategorizationRule(
            user_id=user_id,
            category_id=new_category_id,
            rule_type="merchant",
            pattern=cleaned_pattern,
            priority=10,
            created_by="user",
        )
        db.add(rule)

    await db.flush()

    # Record a cross-user learning signal (PII-safe; hashed user id, only
    # whitelist categories, normalized merchant token). Best-effort — if
    # the salt isn't configured or the user opted out, this is a no-op.
    from app.models.user import User as _User
    from app.services import community_rules_service

    user_obj = await db.get(_User, user_id)
    target_cat = await db.get(Category, new_category_id)
    if user_obj and target_cat:
        try:
            await community_rules_service.record_signal(
                db, user_obj, cleaned_pattern, target_cat.name
            )
        except Exception:
            # Never let signal recording block a user-visible correction.
            pass

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
    # Car Payment
    ("tesla finance", "contains", "Car Payment"),
    ("tesla lease", "contains", "Car Payment"),
    ("toyota financial", "contains", "Car Payment"),
    ("toyota motor credit", "contains", "Car Payment"),
    ("honda financial", "contains", "Car Payment"),
    ("ford motor credit", "contains", "Car Payment"),
    ("gm financial", "contains", "Car Payment"),
    ("ally auto", "contains", "Car Payment"),
    ("ally bank payment", "contains", "Car Payment"),
    ("capital one auto", "contains", "Car Payment"),
    ("chase auto", "contains", "Car Payment"),
    ("bmw financial", "contains", "Car Payment"),
    ("hyundai motor finance", "contains", "Car Payment"),
    ("nissan motor", "contains", "Car Payment"),
    ("carmax auto finance", "contains", "Car Payment"),
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
    # P2P Transfers — regex rules with high priority so they match before generic merchants
    (r"(?i)(venmo|paypal\*venmo)", "regex", "Venmo"),
    (r"(?i)zelle", "regex", "Zelle"),
    (r"(?i)(sqc\*|cash\s*app|square\s*inc.*cash)", "regex", "Cash App"),
    (r"(?i)(paypal|pp\*|pypl)", "regex", "PayPal"),
    (r"(?i)apple\s*cash", "regex", "Apple Cash"),
]


PRIORITY_BUMPS: set[str] = {
    "amazon prime", "youtube premium", "apple.com/bill",
    "disney+", "hbo max", "uber eats",
}


async def repair_rule_priorities(db: AsyncSession, user_id: uuid.UUID) -> None:
    """One-time repairs to categorization rules. Idempotent — safe to call repeatedly.

    1. Bumps more-specific seed rules to priority 6 so they win over broader rules
       with the same type (e.g., "amazon prime" must beat "amazon → Shopping").
    2. Converts legacy subscription-created "contains" rules to "starts_with" so
       they don't accidentally catch transactions from different vendors that share
       a common prefix (e.g., "amazon" shouldn't catch all Amazon transactions).
    """
    if PRIORITY_BUMPS:
        await db.execute(
            update(CategorizationRule)
            .where(
                CategorizationRule.user_id == user_id,
                CategorizationRule.created_by == "system",
                CategorizationRule.pattern.in_(PRIORITY_BUMPS),
                CategorizationRule.priority < 6,
            )
            .values(priority=6)
        )

    # Fix overly-broad subscription rules: "contains" → "starts_with" for specific ones
    await db.execute(
        update(CategorizationRule)
        .where(
            CategorizationRule.user_id == user_id,
            CategorizationRule.created_by == "subscription",
            CategorizationRule.rule_type == "contains",
            func.length(CategorizationRule.pattern) >= 7,
        )
        .values(rule_type="starts_with")
    )

    # Delete subscription rules whose pattern is too short (< 7 chars) to be specific.
    # System seed rules already cover these merchants correctly.
    await db.execute(
        delete(CategorizationRule)
        .where(
            CategorizationRule.user_id == user_id,
            CategorizationRule.created_by == "subscription",
            func.length(CategorizationRule.pattern) < 7,
        )
    )

    await db.flush()


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
        if rule_type == "regex":
            priority = 10
        elif pattern in PRIORITY_BUMPS:
            priority = 6
        else:
            priority = 5
        rule = CategorizationRule(
            user_id=user_id,
            category_id=cat_id,
            rule_type=rule_type,
            pattern=pattern,
            priority=priority,
            created_by="system",
        )
        db.add(rule)

    await db.flush()
    await repair_rule_priorities(db, user_id)


P2P_CATEGORY_NAMES = {"venmo", "zelle", "cash app", "paypal", "apple cash"}


async def apply_transfer_rules(
    db: AsyncSession,
    user_id: uuid.UUID,
    category_id: uuid.UUID | None,
    amount: Decimal,
    txn_date: date,
    description: str,
) -> uuid.UUID | None:
    """Re-categorize a transaction using transfer rules.

    A rule matches when EITHER:
      - rule.source_category_id == category_id (scoped rule), OR
      - rule.match_all_categories is True (global rule that fires on
        description/amount/date alone, regardless of current category).
    """
    from sqlalchemy import or_

    source_clause = TransferRule.match_all_categories.is_(True)
    if category_id is not None:
        source_clause = or_(
            TransferRule.source_category_id == category_id,
            TransferRule.match_all_categories.is_(True),
        )

    result = await db.execute(
        select(TransferRule)
        .where(
            TransferRule.user_id == user_id,
            source_clause,
            TransferRule.is_active.is_(True),
        )
        .order_by(TransferRule.priority.desc())
    )
    rules = list(result.scalars().all())

    abs_amount = abs(amount)
    desc_lower = description.lower()

    for rule in rules:
        if rule.amount_exact is not None:
            if abs(abs_amount - abs(rule.amount_exact)) > Decimal("0.01"):
                continue

        if rule.amount_min is not None and abs_amount < abs(rule.amount_min):
            continue
        if rule.amount_max is not None and abs_amount > abs(rule.amount_max):
            continue

        if rule.day_of_month is not None:
            diff = abs(txn_date.day - rule.day_of_month)
            if diff > rule.day_tolerance and (30 - diff) > rule.day_tolerance:
                continue

        if rule.counterparty_pattern:
            pattern_lower = rule.counterparty_pattern.lower().strip()
            if rule.counterparty_match_type == "exact":
                if desc_lower.strip() != pattern_lower:
                    continue
            elif pattern_lower not in desc_lower:
                continue

        rule.match_count += 1
        await db.flush()
        return rule.target_category_id

    return None


async def seed_p2p_rules(db: AsyncSession, user_id: uuid.UUID) -> None:
    """Seed P2P detection rules for existing users who don't have them yet."""
    result = await db.execute(
        select(CategorizationRule.pattern).where(
            CategorizationRule.user_id == user_id,
            CategorizationRule.rule_type == "regex",
        )
    )
    existing_patterns = {p.lower() for p in result.scalars().all()}

    cat_result = await db.execute(
        select(Category).where(Category.user_id == user_id)
    )
    categories = {c.name.lower(): c.id for c in cat_result.scalars().all()}

    p2p_rules = [r for r in DEFAULT_RULES if r[1] == "regex"]
    for pattern, rule_type, category_name in p2p_rules:
        if pattern.lower() in existing_patterns:
            continue
        cat_id = categories.get(category_name.lower())
        if not cat_id:
            continue
        db.add(
            CategorizationRule(
                user_id=user_id,
                category_id=cat_id,
                rule_type=rule_type,
                pattern=pattern,
                priority=10,
                created_by="system",
            )
        )

    await db.flush()
