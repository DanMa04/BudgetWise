import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel


class AccountCreate(BaseModel):
    name: str
    account_type: str
    institution_name: str | None = None
    currency_code: str = "USD"
    current_balance: Decimal = Decimal("0")
    interest_rate: Decimal | None = None
    original_balance: Decimal | None = None
    minimum_payment: Decimal | None = None
    loan_term_months: int | None = None
    loan_start_date: date | None = None
    return_rate_preset: str | None = None
    custom_return_rate: Decimal | None = None


class AccountRead(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    name: str
    account_type: str
    institution_name: str | None
    currency_code: str
    current_balance: Decimal
    is_active: bool
    plaid_item_id: uuid.UUID | None = None
    plaid_account_id: str | None = None
    interest_rate: Decimal | None = None
    original_balance: Decimal | None = None
    minimum_payment: Decimal | None = None
    loan_term_months: int | None = None
    loan_start_date: date | None = None
    return_rate_preset: str | None = None
    custom_return_rate: Decimal | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class AccountUpdate(BaseModel):
    name: str | None = None
    account_type: str | None = None
    institution_name: str | None = None
    current_balance: Decimal | None = None
    is_active: bool | None = None
    interest_rate: Decimal | None = None
    original_balance: Decimal | None = None
    minimum_payment: Decimal | None = None
    loan_term_months: int | None = None
    loan_start_date: date | None = None
    return_rate_preset: str | None = None
    custom_return_rate: Decimal | None = None
