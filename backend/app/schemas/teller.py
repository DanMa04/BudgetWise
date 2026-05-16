import uuid
from datetime import datetime

from pydantic import BaseModel


class EnrollmentConfigResponse(BaseModel):
    app_id: str
    environment: str


class TellerTokenExchange(BaseModel):
    enrollment_id: str
    institution_id: str
    institution_name: str


class TellerItemRead(BaseModel):
    id: uuid.UUID
    institution_id: str
    institution_name: str
    status: str
    provider: str
    last_synced_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


class TellerSyncResponse(BaseModel):
    added: int
    modified: int
    removed: int
