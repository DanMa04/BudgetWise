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
    is_locked: bool
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


class CategoryAllocation(BaseModel):
    category_id: uuid.UUID
    category_name: str
    category_color: str | None
    category_icon: str | None
    current_budget_amount: float | None
    average_monthly_spend: float
    is_locked: bool
    budget_id: uuid.UUID | None


class GoalAllocation(BaseModel):
    goal_id: uuid.UUID
    name: str
    color: str | None
    target_amount: float
    current_amount: float
    monthly_rate: float
    planned_monthly_contribution: float | None
    target_date: date | None


class AllocationData(BaseModel):
    suggested_monthly_income: float
    monthly_income_override: float | None
    categories: list[CategoryAllocation]
    goals: list[GoalAllocation]


class BulkBudgetItem(BaseModel):
    category_id: uuid.UUID
    amount: float
    is_locked: bool = False


class GoalContributionItem(BaseModel):
    goal_id: uuid.UUID
    monthly_amount: float


class BulkBudgetSave(BaseModel):
    monthly_income: float
    period_type: str = "monthly"
    allocations: list[BulkBudgetItem]
    goal_contributions: list[GoalContributionItem] = []


class BulkBudgetResponse(BaseModel):
    created: int
    updated: int
    deactivated: int
