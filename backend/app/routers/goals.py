import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.goal import (
    ContributionCreate,
    ContributionRead,
    GoalCreate,
    GoalRead,
    GoalSummary,
    GoalUpdate,
    GoalWithProgress,
)
from app.services.goal_service import (
    add_contribution,
    create_goal,
    delete_goal,
    get_contributions,
    get_goal_summary,
    get_goal_with_progress,
    get_goals,
    update_goal,
)

router = APIRouter(prefix="/goals", tags=["goals"])


@router.post("/", response_model=GoalRead, status_code=status.HTTP_201_CREATED)
async def create_goal_endpoint(
    data: GoalCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    goal = await create_goal(db, current_user.id, data)
    return goal


@router.get("/", response_model=list[GoalRead])
async def list_goals(
    active_only: bool = Query(True),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await get_goals(db, current_user.id, active_only=active_only)


@router.get("/summary", response_model=GoalSummary)
async def goal_summary(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await get_goal_summary(db, current_user.id)


@router.get("/{goal_id}", response_model=GoalWithProgress)
async def get_goal_endpoint(
    goal_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await get_goal_with_progress(db, current_user.id, goal_id)
    if not result:
        raise HTTPException(status_code=404, detail="Goal not found")
    goal = result["goal"]
    return GoalWithProgress(
        id=goal.id,
        user_id=goal.user_id,
        name=goal.name,
        goal_type=goal.goal_type,
        target_amount=goal.target_amount,
        current_amount=goal.current_amount,
        currency_code=goal.currency_code,
        icon=goal.icon,
        color=goal.color,
        target_date=goal.target_date,
        linked_account_id=goal.linked_account_id,
        planned_monthly_contribution=goal.planned_monthly_contribution,
        is_active=goal.is_active,
        created_at=goal.created_at,
        updated_at=goal.updated_at,
        percentage=result["percentage"],
        remaining_amount=result["remaining_amount"],
        monthly_rate=result["monthly_rate"],
        projected_completion=result["projected_completion"],
        milestones_reached=result["milestones_reached"],
        contribution_count=result["contribution_count"],
        recent_contributions=result["recent_contributions"],
    )


@router.patch("/{goal_id}", response_model=GoalRead)
async def update_goal_endpoint(
    goal_id: uuid.UUID,
    data: GoalUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    goal = await update_goal(db, current_user.id, goal_id, data)
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")
    return goal


@router.delete("/{goal_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_goal_endpoint(
    goal_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    deleted = await delete_goal(db, current_user.id, goal_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Goal not found")


@router.post(
    "/{goal_id}/contributions",
    response_model=ContributionRead,
    status_code=status.HTTP_201_CREATED,
)
async def add_contribution_endpoint(
    goal_id: uuid.UUID,
    data: ContributionCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        contribution = await add_contribution(db, current_user.id, goal_id, data)
        return contribution
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/{goal_id}/contributions", response_model=list[ContributionRead])
async def list_contributions(
    goal_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        return await get_contributions(db, current_user.id, goal_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
