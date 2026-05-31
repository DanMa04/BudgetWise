"""Developer/test utilities for resetting state.

These endpoints are user-scoped (only ever affect the current user's data) but
the actions are destructive — surface them in the UI as such.
"""

import uuid
from decimal import Decimal

from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified

from app.models.account import Account
from app.models.budget import Budget
from app.models.categorization_rule import CategorizationRule
from app.models.category import Category
from app.models.category_merge_history import CategoryMergeHistory
from app.models.category_snapshot import CategorySnapshot
from app.models.goal import Goal
from app.models.goal_contribution import GoalContribution
from app.models.import_job import ImportJob
from app.models.plaid_item import PlaidItem
from app.models.transaction import Transaction
from app.models.transfer_rule import TransferRule
from app.models.user import User
from app.services.categorization_service import seed_default_rules
from app.services.category_service import seed_default_categories
from app.services.onboarding_service import reset as reset_onboarding


async def wipe_all_data(db: AsyncSession, user: User) -> dict[str, int]:
    """Delete every piece of user-scoped data and re-seed defaults.

    Preserves: user record, notification preferences, extension tokens.
    Resets: monthly_income_override, onboarding_state.
    """
    user_id: uuid.UUID = user.id
    counts: dict[str, int] = {}

    # Goal contributions go first; they FK to goals.
    goal_ids_subq = (
        select(Goal.id).where(Goal.user_id == user_id).scalar_subquery()
    )
    counts["goal_contributions"] = (
        await db.execute(
            delete(GoalContribution).where(GoalContribution.goal_id.in_(goal_ids_subq))
        )
    ).rowcount or 0

    counts["import_jobs"] = (
        await db.execute(delete(ImportJob).where(ImportJob.user_id == user_id))
    ).rowcount or 0
    counts["transactions"] = (
        await db.execute(delete(Transaction).where(Transaction.user_id == user_id))
    ).rowcount or 0
    counts["transfer_rules"] = (
        await db.execute(delete(TransferRule).where(TransferRule.user_id == user_id))
    ).rowcount or 0
    counts["budgets"] = (
        await db.execute(delete(Budget).where(Budget.user_id == user_id))
    ).rowcount or 0
    counts["snapshots"] = (
        await db.execute(
            delete(CategorySnapshot).where(CategorySnapshot.user_id == user_id)
        )
    ).rowcount or 0
    counts["merge_history"] = (
        await db.execute(
            delete(CategoryMergeHistory).where(CategoryMergeHistory.user_id == user_id)
        )
    ).rowcount or 0
    counts["categorization_rules"] = (
        await db.execute(
            delete(CategorizationRule).where(CategorizationRule.user_id == user_id)
        )
    ).rowcount or 0
    counts["goals"] = (
        await db.execute(delete(Goal).where(Goal.user_id == user_id))
    ).rowcount or 0
    counts["accounts"] = (
        await db.execute(delete(Account).where(Account.user_id == user_id))
    ).rowcount or 0
    counts["plaid_items"] = (
        await db.execute(delete(PlaidItem).where(PlaidItem.user_id == user_id))
    ).rowcount or 0
    counts["categories"] = (
        await db.execute(delete(Category).where(Category.user_id == user_id))
    ).rowcount or 0

    await db.flush()

    # Reset user-scoped state on the user row.
    user.monthly_income_override = None
    await reset_onboarding(db, user)

    # Re-seed defaults so the next onboarding has a starting point.
    await seed_default_categories(db, user_id)
    await seed_default_rules(db, user_id)
    await db.flush()

    return counts


async def reset_budget_only(db: AsyncSession, user: User) -> dict[str, int]:
    """Clear all budgets and zero out goal contribution targets.

    Preserves categories, categorization rules, transactions, accounts, and
    the goals themselves (including their current_amount progress). Only
    budget allocations and planned monthly contributions are wiped.
    """
    user_id: uuid.UUID = user.id

    budgets_deleted = (
        await db.execute(delete(Budget).where(Budget.user_id == user_id))
    ).rowcount or 0

    goals_result = await db.execute(
        update(Goal)
        .where(Goal.user_id == user_id)
        .values(planned_monthly_contribution=Decimal("0"))
    )
    goals_updated = goals_result.rowcount or 0

    user.monthly_income_override = None

    # Clear the budget_created onboarding step so the checklist re-surfaces it.
    state = dict(user.onboarding_state or {})
    steps = dict(state.get("steps", {}))
    if steps.get("budget_created", {}).get("done"):
        steps["budget_created"] = {"done": False, "completed_at": None}
        state["steps"] = steps
        # Clear top-level completed_at — onboarding is no longer fully done.
        state["completed_at"] = None
        user.onboarding_state = state
        flag_modified(user, "onboarding_state")

    await db.flush()

    return {"budgets_deleted": budgets_deleted, "goals_zeroed": goals_updated}
