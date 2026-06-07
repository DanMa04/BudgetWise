import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel

Plan = Literal["basic", "pro"]


class UserRead(BaseModel):
    id: uuid.UUID
    email: str | None
    display_name: str | None
    currency_code: str
    timezone: str
    plan: Plan
    onboarding_state: dict[str, Any]
    community_rules_enabled: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class UserUpdate(BaseModel):
    display_name: str | None = None
    currency_code: str | None = None
    timezone: str | None = None
    # TODO: gate behind billing — currently any user can self-promote.
    plan: Plan | None = None
    community_rules_enabled: bool | None = None
