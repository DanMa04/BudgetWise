from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

import httpx
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.account import Account
from app.models.budget import Budget
from app.models.category import Category
from app.models.extension_token import ExtensionToken
from app.models.goal import Goal
from app.models.notification_log import NotificationLog
from app.models.transaction import Transaction
from app.models.user import User

logger = logging.getLogger(__name__)


async def export_user_data(db: AsyncSession, user: User) -> dict:
    """Return a JSON-serializable dict of everything Kallio holds for this user."""

    def _s(v) -> str | None:
        return str(v) if v is not None else None

    def _d(v) -> str | None:
        return v.isoformat() if v is not None else None

    accounts = (
        await db.execute(select(Account).where(Account.user_id == user.id))
    ).scalars().all()

    transactions = (
        await db.execute(select(Transaction).where(Transaction.user_id == user.id))
    ).scalars().all()

    budgets = (
        await db.execute(select(Budget).where(Budget.user_id == user.id))
    ).scalars().all()

    goals = (
        await db.execute(select(Goal).where(Goal.user_id == user.id))
    ).scalars().all()

    categories = (
        await db.execute(
            select(Category).where(
                Category.user_id == user.id,
                Category.is_system.is_(False),
            )
        )
    ).scalars().all()

    log_cutoff = datetime.now(timezone.utc) - timedelta(days=90)
    notification_logs = (
        await db.execute(
            select(NotificationLog).where(
                NotificationLog.user_id == user.id,
                NotificationLog.sent_at >= log_cutoff,
            )
        )
    ).scalars().all()

    return {
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "profile": {
            "display_name": user.display_name,
            "email": user.email,
            "currency_code": user.currency_code,
            "timezone": user.timezone,
            "monthly_income_override": _s(user.monthly_income_override),
            "member_since": _d(user.created_at),
        },
        "accounts": [
            {
                "name": a.name,
                "type": a.account_type,
                "institution": a.institution_name,
                "currency": a.currency_code,
                "balance": _s(a.current_balance),
                "is_active": a.is_active,
                "created_at": _d(a.created_at),
            }
            for a in accounts
        ],
        "transactions": [
            {
                "date": _d(t.date),
                "amount": _s(t.amount),
                "description": t.description,
                "notes": t.notes,
                "is_pending": t.is_pending,
                "is_recurring": t.is_recurring,
                "source": t.source,
                "created_at": _d(t.created_at),
            }
            for t in transactions
        ],
        "budgets": [
            {
                "name": b.name,
                "amount": _s(b.amount),
                "period_type": b.period_type,
                "start_date": _d(b.start_date),
                "end_date": _d(b.end_date),
                "is_active": b.is_active,
                "rollover": b.rollover,
            }
            for b in budgets
        ],
        "goals": [
            {
                "name": g.name,
                "type": g.goal_type,
                "target_amount": _s(g.target_amount),
                "current_amount": _s(g.current_amount),
                "target_date": _d(g.target_date),
                "is_active": g.is_active,
                "created_at": _d(g.created_at),
            }
            for g in goals
        ],
        "categories": [
            {
                "name": c.name,
                "icon": c.icon,
                "color": c.color,
                "is_income": c.is_income,
            }
            for c in categories
        ],
        "notification_history": [
            {
                "title": n.title,
                "message": n.message,
                "type": n.notification_type,
                "sent_at": _d(n.sent_at),
                "is_read": n.is_read,
            }
            for n in notification_logs
        ],
    }


async def delete_user_account(
    db: AsyncSession,
    user: User,
    clerk_secret_key: str,
) -> None:
    """
    Permanently erase a user account.
    1. Delete the Clerk identity so the user cannot sign back in and
       trigger get_or_create_user to recreate a ghost account.
    2. Delete the local User row — CASCADE handles all 16 related tables.
    """
    if clerk_secret_key:
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.delete(
                    f"https://api.clerk.com/v1/users/{user.auth_provider_id}",
                    headers={"Authorization": f"Bearer {clerk_secret_key}"},
                )
                if resp.status_code not in (200, 404):
                    logger.warning(
                        "[GDPR] Clerk deletion returned %s for user %s",
                        resp.status_code,
                        user.auth_provider_id,
                    )
        except Exception as exc:
            logger.warning("[GDPR] Clerk deletion failed (proceeding anyway): %s", exc)

    await db.delete(user)
    await db.flush()


async def cleanup_expired_data(db: AsyncSession) -> dict[str, int]:
    """
    Purge data that has aged past its retention window.
    Runs on app startup; idempotent.
    """
    now = datetime.now(timezone.utc)

    token_result = await db.execute(
        delete(ExtensionToken).where(
            ExtensionToken.expires_at < now - timedelta(days=30)
        )
    )
    log_result = await db.execute(
        delete(NotificationLog).where(
            NotificationLog.sent_at < now - timedelta(days=90)
        )
    )

    return {
        "tokens_deleted": token_result.rowcount,
        "notification_logs_deleted": log_result.rowcount,
    }
