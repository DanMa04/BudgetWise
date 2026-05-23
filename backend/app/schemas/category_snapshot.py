import uuid
from datetime import datetime

from pydantic import BaseModel


class SnapshotRead(BaseModel):
    id: uuid.UUID
    name: str
    trigger: str
    category_count: int
    rule_count: int
    created_at: datetime

    model_config = {"from_attributes": True}


class SnapshotDetail(SnapshotRead):
    categories: dict
    categorization_rules: dict
    transfer_rules: dict
    transaction_assignments: dict


class RestoreResponse(BaseModel):
    categories_restored: int
    rules_restored: int
    transfer_rules_restored: int
    transactions_updated: int
