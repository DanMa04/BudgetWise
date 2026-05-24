import uuid
from datetime import date
from decimal import Decimal

from dateutil.relativedelta import relativedelta
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.account import Account
from app.models.goal import Goal
from app.models.goal_contribution import GoalContribution
from app.schemas.goal import ContributionCreate, GoalCreate, GoalUpdate


async def create_goal(db: AsyncSession, user_id: uuid.UUID, data: GoalCreate) -> Goal:
    goal = Goal(user_id=user_id, **data.model_dump())
    db.add(goal)
    await db.flush()
    await db.refresh(goal)
    return goal


async def get_goals(
    db: AsyncSession, user_id: uuid.UUID, active_only: bool = True
) -> list[Goal]:
    stmt = select(Goal).where(Goal.user_id == user_id)
    if active_only:
        stmt = stmt.where(Goal.is_active.is_(True))
    stmt = stmt.order_by(Goal.created_at.desc())
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def get_goal(
    db: AsyncSession, user_id: uuid.UUID, goal_id: uuid.UUID
) -> Goal | None:
    result = await db.execute(
        select(Goal).where(Goal.id == goal_id, Goal.user_id == user_id)
    )
    return result.scalar_one_or_none()


async def update_goal(
    db: AsyncSession, user_id: uuid.UUID, goal_id: uuid.UUID, data: GoalUpdate
) -> Goal | None:
    goal = await get_goal(db, user_id, goal_id)
    if not goal:
        return None
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(goal, key, value)
    await db.flush()
    await db.refresh(goal)
    return goal


async def delete_goal(
    db: AsyncSession, user_id: uuid.UUID, goal_id: uuid.UUID
) -> bool:
    goal = await get_goal(db, user_id, goal_id)
    if not goal:
        return False
    await db.delete(goal)
    await db.flush()
    return True


async def add_contribution(
    db: AsyncSession,
    user_id: uuid.UUID,
    goal_id: uuid.UUID,
    data: ContributionCreate,
) -> GoalContribution:
    goal = await get_goal(db, user_id, goal_id)
    if not goal:
        raise ValueError("Goal not found")

    contribution_data = data.model_dump()
    if contribution_data["contributed_at"] is None:
        contribution_data["contributed_at"] = date.today()

    contribution = GoalContribution(goal_id=goal_id, **contribution_data)
    db.add(contribution)

    goal.current_amount = goal.current_amount + data.amount
    await db.flush()
    await db.refresh(contribution)
    await db.refresh(goal)
    return contribution


async def get_contributions(
    db: AsyncSession, user_id: uuid.UUID, goal_id: uuid.UUID
) -> list[GoalContribution]:
    goal = await get_goal(db, user_id, goal_id)
    if not goal:
        raise ValueError("Goal not found")

    result = await db.execute(
        select(GoalContribution)
        .where(GoalContribution.goal_id == goal_id)
        .order_by(GoalContribution.contributed_at.desc())
    )
    return list(result.scalars().all())


async def get_goal_with_progress(
    db: AsyncSession, user_id: uuid.UUID, goal_id: uuid.UUID
) -> dict | None:
    goal = await get_goal(db, user_id, goal_id)
    if not goal:
        return None

    # For debt_payoff goals linked to an account, derive progress from account balance
    linked_account = None
    if goal.linked_account_id and goal.goal_type == "debt_payoff":
        acct_result = await db.execute(
            select(Account).where(Account.id == goal.linked_account_id)
        )
        linked_account = acct_result.scalar_one_or_none()

    if linked_account and linked_account.original_balance and linked_account.original_balance > 0:
        original = Decimal(str(linked_account.original_balance))
        current_bal = Decimal(str(linked_account.current_balance or 0))
        paid_off = original - current_bal
        percentage = float(min(Decimal("100"), (paid_off / original) * 100))
        remaining_amount = max(Decimal("0"), current_bal)
    else:
        percentage = float(
            min(Decimal("100"), (goal.current_amount / goal.target_amount) * 100)
        ) if goal.target_amount > 0 else 0.0
        remaining_amount = max(Decimal("0"), goal.target_amount - goal.current_amount)

    today = date.today()
    months_elapsed = max(
        1,
        (today.year - goal.created_at.year) * 12
        + (today.month - goal.created_at.month)
        + 1,
    )

    count_result = await db.execute(
        select(func.count()).where(GoalContribution.goal_id == goal_id)
    )
    contribution_count = count_result.scalar() or 0

    total_contributed_result = await db.execute(
        select(func.coalesce(func.sum(GoalContribution.amount), 0)).where(
            GoalContribution.goal_id == goal_id
        )
    )
    total_contributed = Decimal(str(total_contributed_result.scalar() or 0))

    monthly_rate = total_contributed / months_elapsed

    projected_completion = None
    if monthly_rate > 0 and remaining_amount > 0:
        months_remaining = int(remaining_amount / monthly_rate) + 1
        projected_completion = today + relativedelta(months=months_remaining)

    milestones_reached = []
    for milestone in [25, 50, 75, 100]:
        if percentage >= milestone:
            milestones_reached.append(milestone)

    recent_result = await db.execute(
        select(GoalContribution)
        .where(GoalContribution.goal_id == goal_id)
        .order_by(GoalContribution.contributed_at.desc())
        .limit(5)
    )
    recent_contributions = list(recent_result.scalars().all())

    return {
        "goal": goal,
        "percentage": round(percentage, 2),
        "remaining_amount": remaining_amount,
        "monthly_rate": round(monthly_rate, 2),
        "projected_completion": projected_completion,
        "milestones_reached": milestones_reached,
        "contribution_count": contribution_count,
        "recent_contributions": recent_contributions,
    }


async def get_goal_summary(db: AsyncSession, user_id: uuid.UUID) -> dict:
    all_goals_result = await db.execute(
        select(Goal).where(Goal.user_id == user_id)
    )
    all_goals = list(all_goals_result.scalars().all())

    active_goals = [g for g in all_goals if g.is_active]

    total_target = sum((g.target_amount for g in active_goals), Decimal("0"))
    total_saved = sum((g.current_amount for g in active_goals), Decimal("0"))
    overall_progress = (
        float((total_saved / total_target) * 100) if total_target > 0 else 0.0
    )

    return {
        "total_goals": len(all_goals),
        "active_goals": len(active_goals),
        "total_target": total_target,
        "total_saved": total_saved,
        "overall_progress": round(overall_progress, 2),
    }


async def detect_milestone(goal: Goal) -> int | None:
    if goal.target_amount <= 0:
        return None
    percentage = (goal.current_amount / goal.target_amount) * 100
    for milestone in [100, 75, 50, 25]:
        if percentage >= milestone:
            return milestone
    return None
