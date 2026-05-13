import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.plaid_item import PlaidItem
from app.models.user import User
from app.schemas.plaid import (
    LinkTokenResponse,
    PlaidItemRead,
    PublicTokenExchange,
    SyncResponse,
)
from app.services.plaid_service import get_plaid_service
from app.services.sync_service import (
    link_institution,
    sync_account_transactions,
    sync_all_items,
)

router = APIRouter(prefix="/plaid", tags=["plaid"])


@router.post("/link-token", response_model=LinkTokenResponse)
async def create_link_token(
    current_user: User = Depends(get_current_user),
):
    plaid_service = get_plaid_service()
    link_token = await plaid_service.create_link_token(current_user.id)
    return LinkTokenResponse(link_token=link_token)


@router.post(
    "/exchange-token",
    response_model=PlaidItemRead,
    status_code=status.HTTP_201_CREATED,
)
async def exchange_token(
    data: PublicTokenExchange,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    plaid_item = await link_institution(
        db,
        current_user.id,
        data.public_token,
        data.institution_id,
        data.institution_name,
    )
    return plaid_item


@router.get("/items", response_model=list[PlaidItemRead])
async def list_plaid_items(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(PlaidItem)
        .where(PlaidItem.user_id == current_user.id)
        .order_by(PlaidItem.created_at)
    )
    return list(result.scalars().all())


@router.post("/items/{item_id}/sync", response_model=SyncResponse)
async def sync_item_transactions(
    item_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        sync_result = await sync_account_transactions(db, current_user.id, item_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return SyncResponse(**sync_result)


@router.post("/sync-all", response_model=list[SyncResponse])
async def sync_all(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    results = await sync_all_items(db, current_user.id)
    return [SyncResponse(**r) for r in results]


@router.delete("/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def unlink_institution(
    item_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(PlaidItem).where(
            PlaidItem.id == item_id,
            PlaidItem.user_id == current_user.id,
        )
    )
    plaid_item = result.scalar_one_or_none()
    if not plaid_item:
        raise HTTPException(status_code=404, detail="PlaidItem not found")

    plaid_item.status = "disconnected"
    await db.flush()
