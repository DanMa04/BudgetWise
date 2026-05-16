import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.dependencies import get_current_user
from app.models.plaid_item import PlaidItem
from app.models.user import User
from app.schemas.teller import (
    EnrollmentConfigResponse,
    TellerItemRead,
    TellerSyncResponse,
    TellerTokenExchange,
)
from app.services.sync_service import link_institution, sync_account_transactions
from app.services.teller_service import get_teller_service

router = APIRouter(prefix="/teller", tags=["teller"])


@router.post("/enrollment-config", response_model=EnrollmentConfigResponse)
async def get_enrollment_config(
    current_user: User = Depends(get_current_user),
):
    """Return Teller Connect configuration for the frontend widget."""
    return EnrollmentConfigResponse(
        app_id=settings.teller_application_id,
        environment=settings.teller_env,
    )


@router.post(
    "/exchange-token",
    response_model=TellerItemRead,
    status_code=status.HTTP_201_CREATED,
)
async def exchange_token(
    data: TellerTokenExchange,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Exchange Teller enrollment_id for a stored connection."""
    teller_service = get_teller_service()
    plaid_item = await link_institution(
        db,
        current_user.id,
        data.enrollment_id,
        data.institution_id,
        data.institution_name,
        plaid_service=teller_service,
    )
    # Mark the provider as teller
    plaid_item.provider = "teller"
    await db.flush()
    return plaid_item


@router.get("/items", response_model=list[TellerItemRead])
async def list_teller_items(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all Teller connections for the current user."""
    result = await db.execute(
        select(PlaidItem)
        .where(
            PlaidItem.user_id == current_user.id,
            PlaidItem.provider == "teller",
        )
        .order_by(PlaidItem.created_at)
    )
    return list(result.scalars().all())


@router.post("/items/{item_id}/sync", response_model=TellerSyncResponse)
async def sync_item_transactions(
    item_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Sync transactions for a specific Teller connection."""
    # Verify this item belongs to the user and is a teller item
    result = await db.execute(
        select(PlaidItem).where(
            PlaidItem.id == item_id,
            PlaidItem.user_id == current_user.id,
            PlaidItem.provider == "teller",
        )
    )
    plaid_item = result.scalar_one_or_none()
    if not plaid_item:
        raise HTTPException(status_code=404, detail="Teller item not found")

    teller_service = get_teller_service()
    try:
        sync_result = await sync_account_transactions(
            db, current_user.id, item_id, plaid_service=teller_service
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return TellerSyncResponse(**sync_result)


@router.post("/sync-all", response_model=list[TellerSyncResponse])
async def sync_all(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Sync all Teller connections for the current user."""
    result = await db.execute(
        select(PlaidItem).where(
            PlaidItem.user_id == current_user.id,
            PlaidItem.provider == "teller",
            PlaidItem.status == "active",
        )
    )
    items = list(result.scalars().all())

    teller_service = get_teller_service()
    results = []
    for item in items:
        sync_result = await sync_account_transactions(
            db, current_user.id, item.id, plaid_service=teller_service
        )
        results.append(TellerSyncResponse(**sync_result))
    return results


@router.delete("/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def unlink_institution(
    item_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Disconnect a Teller bank connection."""
    result = await db.execute(
        select(PlaidItem).where(
            PlaidItem.id == item_id,
            PlaidItem.user_id == current_user.id,
            PlaidItem.provider == "teller",
        )
    )
    plaid_item = result.scalar_one_or_none()
    if not plaid_item:
        raise HTTPException(status_code=404, detail="Teller item not found")

    plaid_item.status = "disconnected"
    await db.flush()
