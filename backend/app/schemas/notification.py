from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict


class NotificationPreferenceCreate(BaseModel):
    notification_type: str
    channel: str = "in_app"
    enabled: bool = True
    threshold: int | None = None


class NotificationPreferenceUpdate(BaseModel):
    enabled: bool | None = None
    threshold: int | None = None


class NotificationPreferenceRead(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    notification_type: str
    channel: str
    enabled: bool
    threshold: int | None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class NotificationLogRead(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    notification_type: str
    channel: str
    title: str
    message: str
    data: str | None
    is_read: bool
    sent_at: datetime
    read_at: datetime | None
    status: str
    related_entity_type: str | None
    related_entity_id: uuid.UUID | None
    dedup_key: str | None

    model_config = ConfigDict(from_attributes=True)


class NotificationLogList(BaseModel):
    items: list[NotificationLogRead]
    total: int
    page: int
    per_page: int


class BudgetAlert(BaseModel):
    budget_id: uuid.UUID
    budget_name: str
    category_name: str
    spent: Decimal
    budgeted: Decimal
    percentage: float
    alert_type: str


class PaceAlert(BaseModel):
    budget_id: uuid.UUID
    budget_name: str
    projected_spend: Decimal
    budget_amount: Decimal
    days_remaining: int


class GoalMilestoneAlert(BaseModel):
    goal_id: uuid.UUID
    goal_name: str
    milestone_percentage: int
    current_amount: Decimal
    target_amount: Decimal
