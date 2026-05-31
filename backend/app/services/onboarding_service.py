"""Onboarding state service.

State is stored on User.onboarding_state (JSONB). The shape is loosely typed
so we can add per-step metadata without migrations. Helpers here normalize
reads, merge patches, and compute live counts for the dashboard banner.
"""

from datetime import datetime, timezone
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified

from app.models.account import Account
from app.models.budget import Budget
from app.models.goal import Goal
from app.models.transaction import Transaction
from app.models.user import User
from app.schemas.onboarding import (
    STEP_KEYS,
    OnboardingDerived,
    OnboardingPatch,
    OnboardingState,
    StepKey,
    StepStatus,
)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _empty_state() -> dict[str, Any]:
    return {
        "version": 1,
        "started_at": None,
        "completed_at": None,
        "dismissed_at": None,
        "last_step": None,
        "path": None,
        "steps": {k: {"done": False, "completed_at": None} for k in STEP_KEYS},
        "ai_assist_used": False,
        "wizard_dismissed": False,
    }


def _normalize(raw: dict[str, Any] | None) -> dict[str, Any]:
    base = _empty_state()
    if not raw:
        return base
    # Shallow merge top-level keys; deep merge steps.
    merged = {**base, **{k: v for k, v in raw.items() if k != "steps"}}
    steps_raw = raw.get("steps") or {}
    merged_steps = base["steps"]
    for key, status in steps_raw.items():
        if key in merged_steps and isinstance(status, dict):
            merged_steps[key] = {**merged_steps[key], **status}
    merged["steps"] = merged_steps
    return merged


async def _compute_derived(
    db: AsyncSession, user_id: Any, state: dict[str, Any]
) -> OnboardingDerived:
    account_count = (
        await db.scalar(select(func.count(Account.id)).where(Account.user_id == user_id))
        or 0
    )
    transaction_count = (
        await db.scalar(
            select(func.count(Transaction.id)).where(Transaction.user_id == user_id)
        )
        or 0
    )
    uncategorized_count = (
        await db.scalar(
            select(func.count(Transaction.id)).where(
                Transaction.user_id == user_id,
                Transaction.category_id.is_(None),
            )
        )
        or 0
    )
    goal_count = (
        await db.scalar(
            select(func.count(Goal.id)).where(
                Goal.user_id == user_id, Goal.is_active.is_(True)
            )
        )
        or 0
    )
    active_budget_count = (
        await db.scalar(
            select(func.count(Budget.id)).where(
                Budget.user_id == user_id, Budget.is_active.is_(True)
            )
        )
        or 0
    )

    steps = state["steps"]
    next_step: StepKey | None = None
    for key in STEP_KEYS:
        if not steps[key].get("done"):
            next_step = key
            break
    done_count = sum(1 for k in STEP_KEYS if steps[k].get("done"))
    percent_complete = int(done_count / len(STEP_KEYS) * 100)

    return OnboardingDerived(
        account_count=account_count,
        transaction_count=transaction_count,
        uncategorized_count=uncategorized_count,
        goal_count=goal_count,
        active_budget_count=active_budget_count,
        next_step=next_step,
        percent_complete=percent_complete,
    )


async def get_state(db: AsyncSession, user: User) -> OnboardingState:
    raw = _normalize(user.onboarding_state)
    derived = await _compute_derived(db, user.id, raw)
    return OnboardingState(plan=user.plan, derived=derived, **raw)


async def patch_state(
    db: AsyncSession, user: User, patch: OnboardingPatch
) -> OnboardingState:
    current = _normalize(user.onboarding_state)
    now = _utcnow()

    if current["started_at"] is None:
        current["started_at"] = now.isoformat()

    if patch.last_step is not None:
        current["last_step"] = patch.last_step
    if patch.path is not None:
        current["path"] = patch.path
    if patch.ai_assist_used is not None:
        current["ai_assist_used"] = patch.ai_assist_used

    if patch.steps:
        for key, status in patch.steps.items():
            existing = current["steps"].get(key, {"done": False, "completed_at": None})
            merged = {**existing, **status}
            # Stamp completed_at on false → true transition.
            if not existing.get("done") and merged.get("done"):
                merged["completed_at"] = now.isoformat()
            current["steps"][key] = merged

    # Auto-complete when all steps done.
    if all(current["steps"][k].get("done") for k in STEP_KEYS):
        if current["completed_at"] is None:
            current["completed_at"] = now.isoformat()

    user.onboarding_state = current
    flag_modified(user, "onboarding_state")
    await db.flush()
    derived = await _compute_derived(db, user.id, current)
    return OnboardingState(plan=user.plan, derived=derived, **current)


async def dismiss(db: AsyncSession, user: User) -> OnboardingState:
    current = _normalize(user.onboarding_state)
    current["wizard_dismissed"] = True
    current["dismissed_at"] = _utcnow().isoformat()
    user.onboarding_state = current
    flag_modified(user, "onboarding_state")
    await db.flush()
    derived = await _compute_derived(db, user.id, current)
    return OnboardingState(plan=user.plan, derived=derived, **current)


async def reset(db: AsyncSession, user: User) -> OnboardingState:
    fresh = _empty_state()
    user.onboarding_state = fresh
    flag_modified(user, "onboarding_state")
    await db.flush()
    derived = await _compute_derived(db, user.id, fresh)
    return OnboardingState(plan=user.plan, derived=derived, **fresh)
