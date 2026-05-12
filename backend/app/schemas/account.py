import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel


class AccountCreate(BaseModel):
    name: str
    account_type: str
    institution_name: str | None = None
    currency_code: str = "USD"
    current_balance: Decimal = Decimal("0")


class AccountRead(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    name: str
    account_type: str
    institution_name: str | None
    currency_code: str
    current_balance: Decimal
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class AccountUpdate(BaseModel):
    name: str | None = None
    account_type: str | None = None
    institution_name: str | None = None
    current_balance: Decimal | None = None
    is_active: bool | None = None
