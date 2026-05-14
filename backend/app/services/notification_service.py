import logging
import uuid
from datetime import date, datetime, timezone
from decimal import Decimal

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.budget import Budget
from app.models.category import Category
from app.models.goal import Goal
from app.models.notification_log import NotificationLog
from app.models.notification_preference import NotificationPreference
from app.models.transaction import Transaction
from app.schemas.notification import (
    BudgetAlert,
    GoalMilestoneAlert,
    NotificationPreferenceCreate,
    PaceAlert,
)
from app.services.budget_service import get_current_period

logger = logging.getLogger(__name__)

NOTIFICATION_TYPES = [
    "budget_warning",
    "budget_exceeded",
    "pace_alert",
    "goal_milestone",
    "weekly_summary",
]

DEFAULT_THRESHOLDS = {
    "budget_warning": 80,
    "budget_exceeded": 100,
}


def get_default_preferences(user_id: uuid.UUID) -> list[NotificationPreference]:
    """Return default preference objects (all types x in_app enabled)."""
    preferences = []
    for ntype in NOTIFICATION_TYPES:
        threshold = DEFAULT_THRESHOLDS.get(ntype)
        pref = NotificationPreference(
            user_id=user_id,
            notification_type=ntype,
            channel="in_app",
            enabled=True,
            threshold=threshold,
        )
        preferences.append(pref)
    return preferences


async def ensure_defaults(db: AsyncSession, user_id: uuid.UUID) -> None:
    """Create default preferences if none exist for this user."""
    result = await db.execute(
        select(func.count()).select_from(NotificationPreference).where(
            NotificationPreference.user_id == user_id
        )
    )
    count = result.scalar() or 0
    if count == 0:
        defaults = get_default_preferences(user_id)
        for pref in defaults:
            db.add(pref)
        await db.flush()


async def get_preferences(
    db: AsyncSession, user_id: uuid.UUID
) -> list[NotificationPreference]:
    """List all preferences for a user."""
    result = await db.execute(
        select(NotificationPreference).where(
            NotificationPreference.user_id == user_id
        ).order_by(NotificationPreference.notification_type)
    )
    return list(result.scalars().all())


async def upsert_preference(
    db: AsyncSession, user_id: uuid.UUID, data: NotificationPreferenceCreate
) -> NotificationPreference:
    """Create or update a preference."""
    result = await db.execute(
        select(NotificationPreference).where(
            NotificationPreference.user_id == user_id,
            NotificationPreference.notification_type == data.notification_type,
            NotificationPreference.channel == data.channel,
        )
    )
    existing = result.scalar_one_or_none()

    if existing:
        existing.enabled = data.enabled
        if data.threshold is not None:
            existing.threshold = data.threshold
        await db.flush()
        await db.refresh(existing)
        return existing

    pref = NotificationPreference(
        user_id=user_id,
        notification_type=data.notification_type,
        channel=data.channel,
        enabled=data.enabled,
        threshold=data.threshold,
    )
    db.add(pref)
    await db.flush()
    await db.refresh(pref)
    return pref


async def delete_preference(
    db: AsyncSession, user_id: uuid.UUID, pref_id: uuid.UUID
) -> bool:
    """Delete a preference."""
    result = await db.execute(
        select(NotificationPreference).where(
            NotificationPreference.id == pref_id,
            NotificationPreference.user_id == user_id,
        )
    )
    pref = result.scalar_one_or_none()
    if not pref:
        return False
    await db.delete(pref)
    await db.flush()
    return True


async def create_notification(
    db: AsyncSession,
    user_id: uuid.UUID,
    notification_type: str,
    title: str,
    message: str,
    channel: str = "in_app",
    data: str | None = None,
    related_entity_type: str | None = None,
    related_entity_id: uuid.UUID | None = None,
    dedup_key: str | None = None,
) -> NotificationLog | None:
    """Create a notification, checking dedup_key to prevent duplicates."""
    if dedup_key:
        result = await db.execute(
            select(NotificationLog).where(
                NotificationLog.dedup_key == dedup_key
            )
        )
        if result.scalar_one_or_none():
            return None

    notification = NotificationLog(
        user_id=user_id,
        notification_type=notification_type,
        channel=channel,
        title=title,
        message=message,
        data=data,
        related_entity_type=related_entity_type,
        related_entity_id=related_entity_id,
        dedup_key=dedup_key,
        status="sent",
    )
    db.add(notification)
    await db.flush()
    await db.refresh(notification)

    if channel == "push":
        logger.info("Push notification stub: %s - %s", title, message)
    elif channel == "email":
        logger.info("Email notification stub: %s - %s", title, message)

    return notification


async def get_notifications(
    db: AsyncSession,
    user_id: uuid.UUID,
    page: int = 1,
    per_page: int = 20,
    unread_only: bool = False,
) -> dict:
    """Paginated list of notifications, ordered by sent_at desc."""
    stmt = select(NotificationLog).where(
        NotificationLog.user_id == user_id
    )
    count_stmt = select(func.count()).select_from(NotificationLog).where(
        NotificationLog.user_id == user_id
    )

    if unread_only:
        stmt = stmt.where(NotificationLog.is_read.is_(False))
        count_stmt = count_stmt.where(NotificationLog.is_read.is_(False))

    total_result = await db.execute(count_stmt)
    total = total_result.scalar() or 0

    offset = (page - 1) * per_page
    stmt = stmt.order_by(NotificationLog.sent_at.desc()).offset(offset).limit(per_page)

    result = await db.execute(stmt)
    items = list(result.scalars().all())

    return {
        "items": items,
        "total": total,
        "page": page,
        "per_page": per_page,
    }


async def get_unread_count(db: AsyncSession, user_id: uuid.UUID) -> int:
    """Count of unread in_app notifications."""
    result = await db.execute(
        select(func.count()).select_from(NotificationLog).where(
            NotificationLog.user_id == user_id,
            NotificationLog.is_read.is_(False),
            NotificationLog.channel == "in_app",
        )
    )
    return result.scalar() or 0


async def mark_read(
    db: AsyncSession, user_id: uuid.UUID, notification_id: uuid.UUID
) -> bool:
    """Set is_read=True and read_at=utcnow for a single notification."""
    result = await db.execute(
        select(NotificationLog).where(
            NotificationLog.id == notification_id,
            NotificationLog.user_id == user_id,
        )
    )
    notification = result.scalar_one_or_none()
    if not notification:
        return False
    notification.is_read = True
    notification.read_at = datetime.now(timezone.utc)
    await db.flush()
    return True


async def mark_all_read(db: AsyncSession, user_id: uuid.UUID) -> int:
    """Mark all unread notifications as read. Returns count updated."""
    now = datetime.now(timezone.utc)
    result = await db.execute(
        update(NotificationLog)
        .where(
            NotificationLog.user_id == user_id,
            NotificationLog.is_read.is_(False),
        )
        .values(is_read=True, read_at=now)
    )
    await db.flush()
    return result.rowcount


async def delete_notification(
    db: AsyncSession, user_id: uuid.UUID, notification_id: uuid.UUID
) -> bool:
    """Delete a notification."""
    result = await db.execute(
        select(NotificationLog).where(
            NotificationLog.id == notification_id,
            NotificationLog.user_id == user_id,
        )
    )
    notification = result.scalar_one_or_none()
    if not notification:
        return False
    await db.delete(notification)
    await db.flush()
    return True


def _get_period_key(budget: Budget) -> str:
    """Generate a period key for deduplication based on the current period."""
    period_start, _ = get_current_period(budget)
    return f"{budget.period_type}_{period_start.isoformat()}"


async def _is_preference_enabled(
    db: AsyncSession,
    user_id: uuid.UUID,
    notification_type: str,
    channel: str = "in_app",
) -> bool:
    """Check if a specific notification preference is enabled."""
    result = await db.execute(
        select(NotificationPreference).where(
            NotificationPreference.user_id == user_id,
            NotificationPreference.notification_type == notification_type,
            NotificationPreference.channel == channel,
        )
    )
    pref = result.scalar_one_or_none()
    if pref is None:
        return True  # Default to enabled if no preference exists
    return pref.enabled


async def check_budget_alerts(
    db: AsyncSession, user_id: uuid.UUID
) -> list[BudgetAlert]:
    """Check all active budgets for threshold alerts."""
    alerts: list[BudgetAlert] = []

    # Check if budget_warning preference is enabled
    warning_enabled = await _is_preference_enabled(
        db, user_id, "budget_warning"
    )
    exceeded_enabled = await _is_preference_enabled(
        db, user_id, "budget_exceeded"
    )

    if not warning_enabled and not exceeded_enabled:
        return alerts

    # Get user's enabled thresholds from preferences
    thresholds_to_check = []
    if warning_enabled:
        # Get custom threshold or use defaults
        result = await db.execute(
            select(NotificationPreference).where(
                NotificationPreference.user_id == user_id,
                NotificationPreference.notification_type == "budget_warning",
                NotificationPreference.channel == "in_app",
            )
        )
        pref = result.scalar_one_or_none()
        threshold_val = pref.threshold if pref and pref.threshold else 80
        thresholds_to_check.append((threshold_val, "budget_warning"))
    if exceeded_enabled:
        thresholds_to_check.append((100, "budget_exceeded"))

    # Also check 90% as a standard warning level
    if warning_enabled:
        thresholds_to_check.append((90, "budget_warning"))

    # Get all active budgets
    budget_result = await db.execute(
        select(Budget).where(
            Budget.user_id == user_id,
            Budget.is_active.is_(True),
        )
    )
    budgets = list(budget_result.scalars().all())

    for budget in budgets:
        period_start, period_end = get_current_period(budget)
        period_key = _get_period_key(budget)

        # Get category name
        cat_result = await db.execute(
            select(Category.name).where(Category.id == budget.category_id)
        )
        category_name = cat_result.scalar() or "Unknown"

        # Calculate spent amount
        spend_result = await db.execute(
            select(func.coalesce(func.sum(Transaction.amount), 0)).where(
                Transaction.user_id == user_id,
                Transaction.category_id == budget.category_id,
                Transaction.date >= period_start,
                Transaction.date <= period_end,
                Transaction.amount > 0,
            )
        )
        spent = Decimal(str(spend_result.scalar() or 0))
        budget_amount = budget.amount
        percentage = (
            float(spent / budget_amount * 100) if budget_amount > 0 else 0
        )

        for threshold, alert_type in thresholds_to_check:
            if percentage >= threshold:
                dedup_key = (
                    f"budget_{budget.id}_threshold_{threshold}_{period_key}"
                )

                if alert_type == "budget_exceeded" and threshold == 100:
                    title = f"Budget exceeded: {budget.name}"
                    message = (
                        f"You've spent ${spent:.2f} of your "
                        f"${budget_amount:.2f} {budget.name} budget "
                        f"({percentage:.0f}%)."
                    )
                else:
                    title = f"Budget warning: {budget.name}"
                    message = (
                        f"You've used {percentage:.0f}% of your "
                        f"${budget_amount:.2f} {budget.name} budget "
                        f"(${spent:.2f} spent)."
                    )

                notification = await create_notification(
                    db,
                    user_id=user_id,
                    notification_type=alert_type,
                    title=title,
                    message=message,
                    channel="in_app",
                    related_entity_type="budget",
                    related_entity_id=budget.id,
                    dedup_key=dedup_key,
                )

                if notification:
                    alerts.append(
                        BudgetAlert(
                            budget_id=budget.id,
                            budget_name=budget.name,
                            category_name=category_name,
                            spent=spent,
                            budgeted=budget_amount,
                            percentage=round(percentage, 2),
                            alert_type=alert_type,
                        )
                    )

    return alerts


async def check_pace_alerts(
    db: AsyncSession, user_id: uuid.UUID
) -> list[PaceAlert]:
    """Check pace of spending for active budgets. Project end-of-period spend."""
    alerts: list[PaceAlert] = []

    pace_enabled = await _is_preference_enabled(db, user_id, "pace_alert")
    if not pace_enabled:
        return alerts

    budget_result = await db.execute(
        select(Budget).where(
            Budget.user_id == user_id,
            Budget.is_active.is_(True),
        )
    )
    budgets = list(budget_result.scalars().all())
    today = date.today()

    for budget in budgets:
        period_start, period_end = get_current_period(budget)
        period_key = _get_period_key(budget)

        days_elapsed = (today - period_start).days + 1
        total_days = (period_end - period_start).days + 1
        days_remaining = max(0, (period_end - today).days)

        if days_elapsed <= 0:
            continue

        # Calculate spent so far
        spend_result = await db.execute(
            select(func.coalesce(func.sum(Transaction.amount), 0)).where(
                Transaction.user_id == user_id,
                Transaction.category_id == budget.category_id,
                Transaction.date >= period_start,
                Transaction.date <= period_end,
                Transaction.amount > 0,
            )
        )
        spent = Decimal(str(spend_result.scalar() or 0))

        if spent <= 0:
            continue

        # Project end-of-period spend based on daily rate
        daily_rate = spent / days_elapsed
        projected_spend = daily_rate * total_days

        if projected_spend > budget.amount:
            dedup_key = f"pace_{budget.id}_{period_key}"

            title = f"Spending pace alert: {budget.name}"
            message = (
                f"At your current pace, you're projected to spend "
                f"${projected_spend:.2f} against your "
                f"${budget.amount:.2f} {budget.name} budget. "
                f"{days_remaining} days remaining."
            )

            notification = await create_notification(
                db,
                user_id=user_id,
                notification_type="pace_alert",
                title=title,
                message=message,
                channel="in_app",
                related_entity_type="budget",
                related_entity_id=budget.id,
                dedup_key=dedup_key,
            )

            if notification:
                alerts.append(
                    PaceAlert(
                        budget_id=budget.id,
                        budget_name=budget.name,
                        projected_spend=round(projected_spend, 2),
                        budget_amount=budget.amount,
                        days_remaining=days_remaining,
                    )
                )

    return alerts


async def check_goal_milestones(
    db: AsyncSession,
    user_id: uuid.UUID,
    goal_id: uuid.UUID,
    old_percentage: float,
    new_percentage: float,
) -> list[GoalMilestoneAlert]:
    """Check if a milestone (25/50/75/100) was crossed after a contribution."""
    alerts: list[GoalMilestoneAlert] = []

    milestone_enabled = await _is_preference_enabled(
        db, user_id, "goal_milestone"
    )
    if not milestone_enabled:
        return alerts

    goal_result = await db.execute(
        select(Goal).where(Goal.id == goal_id, Goal.user_id == user_id)
    )
    goal = goal_result.scalar_one_or_none()
    if not goal:
        return alerts

    milestones = [25, 50, 75, 100]
    for milestone in milestones:
        if old_percentage < milestone <= new_percentage:
            dedup_key = f"goal_{goal_id}_milestone_{milestone}"

            title = f"Goal milestone: {goal.name}"
            message = (
                f"Congratulations! You've reached {milestone}% of your "
                f"{goal.name} goal "
                f"(${goal.current_amount:.2f} / ${goal.target_amount:.2f})."
            )

            notification = await create_notification(
                db,
                user_id=user_id,
                notification_type="goal_milestone",
                title=title,
                message=message,
                channel="in_app",
                related_entity_type="goal",
                related_entity_id=goal_id,
                dedup_key=dedup_key,
            )

            if notification:
                alerts.append(
                    GoalMilestoneAlert(
                        goal_id=goal_id,
                        goal_name=goal.name,
                        milestone_percentage=milestone,
                        current_amount=goal.current_amount,
                        target_amount=goal.target_amount,
                    )
                )

    return alerts
