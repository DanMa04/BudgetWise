from __future__ import annotations

import uuid
from decimal import Decimal

from pydantic import BaseModel


class BudgetStatusItem(BaseModel):
    id: uuid.UUID
    name: str
    category_name: str
    budgeted: Decimal
    spent: Decimal
    remaining: Decimal
    percentage_used: float


class BudgetCheckResponse(BaseModel):
    total_budgeted: Decimal
    total_spent: Decimal
    total_remaining: Decimal
    budgets: list[BudgetStatusItem]


class CartCheckRequest(BaseModel):
    cart_total: Decimal
    merchant: str
    site: str  # "amazon", "target", "walmart"


class CartCheckResponse(BaseModel):
    can_afford: bool
    cart_total: Decimal
    total_remaining: Decimal
    warning_level: str  # "green", "yellow", "red"
    message: str
    affected_budgets: list[BudgetStatusItem]
