import uuid
from datetime import datetime

from pydantic import BaseModel


class TransferRuleCreate(BaseModel):
    source_category_id: uuid.UUID
    target_category_id: uuid.UUID
    name: str
    amount_exact: float | None = None
    amount_min: float | None = None
    amount_max: float | None = None
    day_of_month: int | None = None
    day_tolerance: int = 2
    counterparty_pattern: str | None = None
    priority: int = 0


class TransferRuleUpdate(BaseModel):
    target_category_id: uuid.UUID | None = None
    name: str | None = None
    amount_exact: float | None = None
    amount_min: float | None = None
    amount_max: float | None = None
    day_of_month: int | None = None
    day_tolerance: int | None = None
    counterparty_pattern: str | None = None
    is_active: bool | None = None
    priority: int | None = None


class TransferRuleRead(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    source_category_id: uuid.UUID
    target_category_id: uuid.UUID
    name: str
    amount_exact: float | None
    amount_min: float | None
    amount_max: float | None
    day_of_month: int | None
    day_tolerance: int
    counterparty_pattern: str | None
    is_active: bool
    priority: int
    match_count: int
    created_at: datetime

    model_config = {"from_attributes": True}
