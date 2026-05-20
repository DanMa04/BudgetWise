import uuid
from datetime import datetime

from pydantic import BaseModel


class CategoryRead(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID | None
    parent_id: uuid.UUID | None
    name: str
    icon: str | None
    color: str | None
    is_system: bool
    is_income: bool
    sort_order: int
    created_at: datetime

    model_config = {"from_attributes": True}


class CategoryCreate(BaseModel):
    name: str
    parent_id: uuid.UUID | None = None
    icon: str | None = None
    color: str | None = None
    is_income: bool = False
    sort_order: int = 0


class CategoryUpdate(BaseModel):
    name: str | None = None
    parent_id: uuid.UUID | None = None
    icon: str | None = None
    color: str | None = None
    is_income: bool | None = None
    sort_order: int | None = None


class MergeCategoryRequest(BaseModel):
    source_id: uuid.UUID
    target_id: uuid.UUID


class MergeCategoryResponse(BaseModel):
    target_id: uuid.UUID
    transactions_moved: int
    rules_moved: int
    budgets_merged: int


class MergeSuggestion(BaseModel):
    source: CategoryRead
    target: CategoryRead
    similarity_score: float


class CategoryWithSpend(CategoryRead):
    total_spend: float
    transaction_count: int


class SubordinateCategoryRequest(BaseModel):
    source_id: uuid.UUID
    parent_id: uuid.UUID
