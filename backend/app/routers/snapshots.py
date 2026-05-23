import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.category_snapshot import RestoreResponse, SnapshotRead
from app.services.snapshot_service import (
    create_snapshot,
    delete_snapshot,
    list_snapshots,
    restore_snapshot,
)

router = APIRouter(prefix="/snapshots", tags=["snapshots"])


@router.get("/", response_model=list[SnapshotRead])
async def get_snapshots(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await list_snapshots(db, current_user.id)


@router.post("/", response_model=SnapshotRead, status_code=status.HTTP_201_CREATED)
async def create_manual_snapshot(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await create_snapshot(db, current_user.id, "Manual save", "manual")


@router.post("/{snapshot_id}/restore", response_model=RestoreResponse)
async def restore_from_snapshot(
    snapshot_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        result = await restore_snapshot(db, current_user.id, snapshot_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return result


@router.delete("/{snapshot_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_snapshot_endpoint(
    snapshot_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    deleted = await delete_snapshot(db, current_user.id, snapshot_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Snapshot not found")
