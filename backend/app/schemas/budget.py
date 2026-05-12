from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel


class BudgetCreate(BaseModel):
    category_id: uuid.UUID
    name: str
    amount: Decimal
    period_type: str = "monthly"
    start_date: date
    end_date: date | None = None
    rollover: bool = False


class BudgetRead(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    category_id: uuid.UUID
    name: str
    amount: Decimal
    period_type: str
    start_date: date
    end_date: date | None
    is_active: bool
    rollover: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class BudgetUpdate(BaseModel):
    name: str | None = None
    amount: Decimal | None = None
    period_type: str | None = None
    end_date: date | None = None
    is_active: bool | None = None
    rollover: bool | None = None


class BudgetWithSpend(BudgetRead):
    spent_amount: float
    remaining_amount: float
    percentage_used: float


class BudgetSummary(BaseModel):
    total_budgeted: float
    total_spent: float
    total_remaining: float
    budgets: list[BudgetWithSpend]
