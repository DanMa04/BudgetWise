from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel


class GoalCreate(BaseModel):
    name: str
    goal_type: str
    target_amount: Decimal
    current_amount: Decimal = Decimal("0")
    currency_code: str = "USD"
    icon: str | None = None
    color: str | None = None
    target_date: date | None = None
    linked_account_id: uuid.UUID | None = None


class GoalRead(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    name: str
    goal_type: str
    target_amount: Decimal
    current_amount: Decimal
    currency_code: str
    icon: str | None
    color: str | None
    target_date: date | None
    linked_account_id: uuid.UUID | None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class GoalUpdate(BaseModel):
    name: str | None = None
    target_amount: Decimal | None = None
    icon: str | None = None
    color: str | None = None
    target_date: date | None = None
    linked_account_id: uuid.UUID | None = None
    is_active: bool | None = None


class ContributionCreate(BaseModel):
    amount: Decimal
    note: str | None = None
    transaction_id: uuid.UUID | None = None
    contributed_at: date | None = None


class ContributionRead(BaseModel):
    id: uuid.UUID
    goal_id: uuid.UUID
    amount: Decimal
    note: str | None
    transaction_id: uuid.UUID | None
    contributed_at: date
    created_at: datetime

    model_config = {"from_attributes": True}


class GoalWithProgress(GoalRead):
    percentage: float
    remaining_amount: Decimal
    monthly_rate: Decimal
    projected_completion: date | None
    milestones_reached: list[int]
    contribution_count: int
    recent_contributions: list[ContributionRead]


class GoalSummary(BaseModel):
    total_goals: int
    active_goals: int
    total_target: Decimal
    total_saved: Decimal
    overall_progress: float
