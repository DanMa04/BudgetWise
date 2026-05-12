from __future__ import annotations

import uuid
from datetime import date as date_type
from datetime import datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel


class TransactionCreate(BaseModel):
    account_id: uuid.UUID
    category_id: uuid.UUID | None = None
    date: date_type
    amount: Decimal
    description: str
    notes: str | None = None
    is_pending: bool = False
    is_recurring: bool = False


class TransactionRead(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    account_id: uuid.UUID
    category_id: uuid.UUID | None
    date: date_type
    amount: Decimal
    description: str
    notes: str | None
    is_pending: bool
    is_recurring: bool
    source: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TransactionUpdate(BaseModel):
    category_id: uuid.UUID | None = None
    date: Optional[date_type] = None
    amount: Decimal | None = None
    description: str | None = None
    notes: str | None = None
    is_pending: bool | None = None
    is_recurring: bool | None = None


class TransactionFilter(BaseModel):
    date_from: Optional[date_type] = None
    date_to: Optional[date_type] = None
    category_id: uuid.UUID | None = None
    account_id: uuid.UUID | None = None
    min_amount: Decimal | None = None
    max_amount: Decimal | None = None
    search: str | None = None
