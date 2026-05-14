import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.notification import (
    NotificationLogList,
    NotificationPreferenceCreate,
    NotificationPreferenceRead,
)
from app.services.notification_service import (
    check_budget_alerts,
    check_pace_alerts,
    delete_notification,
    delete_preference,
    ensure_defaults,
    get_notifications,
    get_preferences,
    get_unread_count,
    mark_all_read,
    mark_read,
    upsert_preference,
)

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("/", response_model=NotificationLogList)
async def list_notifications(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    unread_only: bool = Query(False),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await get_notifications(
        db, current_user.id, page=page, per_page=per_page, unread_only=unread_only
    )
    return result


@router.get("/unread-count")
async def unread_count(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    count = await get_unread_count(db, current_user.id)
    return {"count": count}


@router.post("/{notification_id}/read", response_model=dict)
async def mark_notification_read(
    notification_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    success = await mark_read(db, current_user.id, notification_id)
    if not success:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"success": True}


@router.post("/read-all", response_model=dict)
async def mark_all_notifications_read(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    count = await mark_all_read(db, current_user.id)
    return {"updated": count}


@router.delete("/{notification_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_notification_endpoint(
    notification_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    deleted = await delete_notification(db, current_user.id, notification_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Notification not found")


@router.get("/preferences", response_model=list[NotificationPreferenceRead])
async def list_preferences(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await ensure_defaults(db, current_user.id)
    return await get_preferences(db, current_user.id)


@router.put("/preferences", response_model=NotificationPreferenceRead)
async def upsert_preference_endpoint(
    data: NotificationPreferenceCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await upsert_preference(db, current_user.id, data)


@router.delete(
    "/preferences/{pref_id}", status_code=status.HTTP_204_NO_CONTENT
)
async def delete_preference_endpoint(
    pref_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    deleted = await delete_preference(db, current_user.id, pref_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Preference not found")


@router.post("/check")
async def check_alerts(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await ensure_defaults(db, current_user.id)
    budget_alerts = await check_budget_alerts(db, current_user.id)
    pace_alerts = await check_pace_alerts(db, current_user.id)
    return {
        "budget_alerts": [a.model_dump() for a in budget_alerts],
        "pace_alerts": [a.model_dump() for a in pace_alerts],
    }
