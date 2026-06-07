"""Cross-user rule learning.

When a user manually corrects a transaction's category, we want every
*other* user to benefit if the same correction recurs enough across the
user base — but we never want to leak who corrected what or expose any
PII embedded in transaction descriptions.

Design:
  - record_signal() writes a tuple (cleaned pattern, target category name,
    hashed user id) to community_corrections. The hash is sha256 over
    user_id + a global salt — irreversible, but stable per user so one
    user can't pump up their own signal by repeating it.
  - PII guards reject anything that doesn't look like a clean merchant
    token: must be ASCII letters/spaces, 4-50 chars, no remaining digits,
    no '@'. Target category name must be in a whitelist of system-default
    categories (no custom-named categories that could themselves leak).
  - aggregate_and_promote() finds (pattern, category_name) pairs with
    >= community_rule_min_users distinct hashes that haven't already been
    promoted. For each, it inserts a CategorizationRule(created_by=
    "community") into every user who (a) has opted in, (b) has the
    matching category, and (c) doesn't already have a rule for that
    pattern.
  - seed_community_rules() runs on user creation, copying all currently
    active community rules into the new user's account.
  - Users who set community_rules_enabled=False contribute no signals
    and receive no community rules.
"""

import hashlib
import re
import uuid
from typing import Iterable

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.categorization_rule import CategorizationRule
from app.models.category import Category
from app.models.community_correction import CommunityCorrection
from app.models.community_promotion import CommunityPromotion
from app.models.user import User

# Only promote rules targeting these category names (case-insensitive).
# Avoids leaking custom user-named categories like "Dad's Birthday Fund".
WHITELIST_CATEGORIES = {
    "housing",
    "transportation",
    "groceries",
    "dining out",
    "entertainment",
    "shopping",
    "healthcare",
    "utilities",
    "insurance",
    "education",
    "personal care",
    "subscriptions",
    "travel",
    "gifts & donations",
    "car payment",
    "investment contribution",
    "miscellaneous",
}

_PATTERN_OK = re.compile(r"^[a-z][a-z &'\-]+[a-z]$")
_MIN_PATTERN_LEN = 4
_MAX_PATTERN_LEN = 50


def _normalize_pattern(raw_pattern: str) -> str | None:
    """Apply final PII / quality guards. Returns the canonical pattern or
    None if it should be dropped.

    The input is already TransactionCategorizer.clean_description() output
    (lowercased, stripped of '#*', stripped of 4+ digit sequences). Here
    we drop ALL remaining digits and validate ASCII-merchant-ish shape.
    """
    if not raw_pattern:
        return None
    # Strip remaining 1-3 digit sequences and any '@'.
    candidate = re.sub(r"\d+", "", raw_pattern)
    candidate = candidate.replace("@", "")
    # Collapse whitespace.
    candidate = re.sub(r"\s+", " ", candidate).strip()
    if not (_MIN_PATTERN_LEN <= len(candidate) <= _MAX_PATTERN_LEN):
        return None
    if not _PATTERN_OK.fullmatch(candidate):
        return None
    return candidate


def _canonical_category(name: str) -> str | None:
    lowered = (name or "").strip().lower()
    if lowered in WHITELIST_CATEGORIES:
        return lowered
    return None


def _hash_user(user_id: uuid.UUID) -> str | None:
    salt = settings.community_rule_salt
    if not salt:
        return None
    digest = hashlib.sha256(f"{user_id}:{salt}".encode()).hexdigest()
    return digest


async def record_signal(
    db: AsyncSession,
    user: User,
    raw_pattern: str,
    category_name: str,
) -> bool:
    """Record one user's correction as a signal. Idempotent per user.

    Returns True if the signal was written, False if it was filtered or
    deduped. Safe to call from inside record_correction; never raises.
    """
    if not user.community_rules_enabled:
        return False
    user_hash = _hash_user(user.id)
    if not user_hash:
        # Fail-closed when salt isn't configured.
        return False
    pattern = _normalize_pattern(raw_pattern)
    if not pattern:
        return False
    canonical = _canonical_category(category_name)
    if not canonical:
        return False

    # Insert; rely on the unique constraint to dedupe.
    existing = await db.scalar(
        select(CommunityCorrection.id).where(
            CommunityCorrection.pattern == pattern,
            CommunityCorrection.category_name == canonical,
            CommunityCorrection.user_hash == user_hash,
        )
    )
    if existing:
        return False
    db.add(
        CommunityCorrection(
            id=uuid.uuid4(),
            pattern=pattern,
            category_name=canonical,
            user_hash=user_hash,
        )
    )
    await db.flush()
    return True


async def _matching_category_id(
    db: AsyncSession, user_id: uuid.UUID, canonical_name: str
) -> uuid.UUID | None:
    """Find the user's category id whose name (case-insensitive) matches
    the canonical community-rule category name."""
    return await db.scalar(
        select(Category.id).where(
            Category.user_id == user_id,
            func.lower(Category.name) == canonical_name,
        )
    )


async def _existing_rule_for_pattern(
    db: AsyncSession, user_id: uuid.UUID, pattern: str
) -> bool:
    """True if the user already has an active rule for this pattern (any
    rule_type, any category). Avoids stomping on their explicit choices."""
    return bool(
        await db.scalar(
            select(CategorizationRule.id).where(
                CategorizationRule.user_id == user_id,
                func.lower(CategorizationRule.pattern) == pattern,
                CategorizationRule.is_active.is_(True),
            )
        )
    )


async def _seed_one_rule_for_users(
    db: AsyncSession,
    pattern: str,
    canonical: str,
    users: Iterable[User],
) -> int:
    """Create a CategorizationRule for each user that has the matching
    category, has community rules enabled, and doesn't already have a
    rule for this pattern. Returns the number of rules created."""
    created = 0
    for u in users:
        if not u.community_rules_enabled:
            continue
        cat_id = await _matching_category_id(db, u.id, canonical)
        if not cat_id:
            continue
        if await _existing_rule_for_pattern(db, u.id, pattern):
            continue
        db.add(
            CategorizationRule(
                user_id=u.id,
                category_id=cat_id,
                rule_type="merchant",
                pattern=pattern,
                priority=5,  # below user-created (10), above seeded defaults (0)
                created_by="community",
            )
        )
        created += 1
    if created:
        await db.flush()
    return created


async def aggregate_and_promote(db: AsyncSession) -> dict[str, int]:
    """Promote any (pattern, category_name) pair that has crossed the
    threshold into actual CategorizationRule rows for opted-in users.

    Returns counts: {patterns_promoted, rules_created}.
    """
    threshold = max(1, int(settings.community_rule_min_users))

    # Find candidate (pattern, category_name) groups with distinct user
    # hashes >= threshold. Exclude already-promoted pairs.
    promoted_pairs = {
        (p, c)
        for (p, c) in (
            await db.execute(
                select(CommunityPromotion.pattern, CommunityPromotion.category_name)
            )
        ).all()
    }

    candidates = (
        await db.execute(
            select(
                CommunityCorrection.pattern,
                CommunityCorrection.category_name,
                func.count(func.distinct(CommunityCorrection.user_hash)).label("n"),
            )
            .group_by(
                CommunityCorrection.pattern, CommunityCorrection.category_name
            )
            .having(
                func.count(func.distinct(CommunityCorrection.user_hash)) >= threshold
            )
        )
    ).all()

    opted_in_users = list(
        (
            await db.execute(
                select(User).where(User.community_rules_enabled.is_(True))
            )
        )
        .scalars()
        .all()
    )

    patterns_promoted = 0
    rules_created = 0
    for pattern, canonical, n_users in candidates:
        if (pattern, canonical) in promoted_pairs:
            continue
        rules_created += await _seed_one_rule_for_users(
            db, pattern, canonical, opted_in_users
        )
        db.add(
            CommunityPromotion(
                id=uuid.uuid4(),
                pattern=pattern,
                category_name=canonical,
                contributing_users=int(n_users),
            )
        )
        patterns_promoted += 1
    if patterns_promoted:
        await db.flush()
    return {
        "patterns_promoted": patterns_promoted,
        "rules_created": rules_created,
    }


async def seed_community_rules(db: AsyncSession, user_id: uuid.UUID) -> int:
    """For a brand-new user (or one toggling opt-in back on), copy every
    already-promoted community rule into their account where they have a
    matching category. Returns the number of rules added."""
    user = await db.get(User, user_id)
    if not user or not user.community_rules_enabled:
        return 0
    promotions = list(
        (
            await db.execute(
                select(CommunityPromotion.pattern, CommunityPromotion.category_name)
            )
        ).all()
    )
    created = 0
    for pattern, canonical in promotions:
        cat_id = await _matching_category_id(db, user.id, canonical)
        if not cat_id:
            continue
        if await _existing_rule_for_pattern(db, user.id, pattern):
            continue
        db.add(
            CategorizationRule(
                user_id=user.id,
                category_id=cat_id,
                rule_type="merchant",
                pattern=pattern,
                priority=5,
                created_by="community",
            )
        )
        created += 1
    if created:
        await db.flush()
    return created
