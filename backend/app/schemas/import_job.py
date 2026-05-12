from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel


class ImportJobRead(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    account_id: uuid.UUID
    filename: str
    file_type: str
    status: str
    column_mapping: dict[str, str] | None
    total_rows: int | None
    imported_rows: int
    skipped_rows: int
    error_rows: int
    errors: list[dict] | None
    created_at: datetime
    completed_at: datetime | None

    model_config = {"from_attributes": True}


class ColumnMappingRequest(BaseModel):
    mapping: dict[str, str]


class ImportPreviewRow(BaseModel):
    date: str
    amount: float
    description: str
    category: str | None = None
    notes: str | None = None
    warnings: list[str] = []
    is_duplicate: bool = False


class ImportPreviewResponse(BaseModel):
    rows: list[ImportPreviewRow]
    total_rows: int
    warnings: list[str] = []


class AutoDetectResponse(BaseModel):
    job_id: uuid.UUID
    headers: list[str]
    suggested_mapping: dict[str, str]
    sample_rows: list[dict[str, str]]
    total_rows: int
