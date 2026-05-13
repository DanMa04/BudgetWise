import uuid
from datetime import datetime

from pydantic import BaseModel


class LinkTokenResponse(BaseModel):
    link_token: str


class PublicTokenExchange(BaseModel):
    public_token: str
    institution_id: str
    institution_name: str


class PlaidItemRead(BaseModel):
    id: uuid.UUID
    institution_id: str
    institution_name: str
    status: str
    last_synced_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


class SyncResponse(BaseModel):
    added: int
    modified: int
    removed: int
