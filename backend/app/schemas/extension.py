from __future__ import annotations

import uuid
from datetime import datetime
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


class ExtensionTokenResponse(BaseModel):
    token: str
    expires_at: datetime


class ExtensionTokenStatus(BaseModel):
    is_connected: bool
    expires_at: datetime | None = None
