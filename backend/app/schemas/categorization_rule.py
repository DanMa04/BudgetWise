import uuid
from datetime import datetime

from pydantic import BaseModel


class RuleCreate(BaseModel):
    category_id: uuid.UUID
    rule_type: str
    pattern: str
    priority: int = 0


class RuleRead(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    category_id: uuid.UUID
    rule_type: str
    pattern: str
    priority: int
    is_active: bool
    created_by: str
    match_count: int
    created_at: datetime

    model_config = {"from_attributes": True}


class RuleUpdate(BaseModel):
    pattern: str | None = None
    priority: int | None = None
    is_active: bool | None = None


class CorrectionRequest(BaseModel):
    category_id: uuid.UUID
    create_rule: bool = False


class CategorizationRequest(BaseModel):
    description: str


class CategorizationResponse(BaseModel):
    category_id: uuid.UUID | None
    confidence: float
    source: str


class BulkCategorizeRequest(BaseModel):
    transaction_ids: list[uuid.UUID]
    category_id: uuid.UUID
