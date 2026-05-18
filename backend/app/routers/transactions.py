import math
import uuid
from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.transaction import (
    TransactionCreate,
    TransactionFilter,
    TransactionRead,
    TransactionUpdate,
)
from app.services.transaction_service import (
    create_transaction,
    delete_transaction,
    get_transaction,
    get_transactions,
    update_transaction,
)

router = APIRouter(prefix="/transactions", tags=["transactions"])


@router.post("/", response_model=TransactionRead, status_code=status.HTTP_201_CREATED)
async def create_transaction_endpoint(
    data: TransactionCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    transaction = await create_transaction(db, current_user.id, data)
    return transaction


@router.get("/")
async def list_transactions(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=100),
    date_from: date | None = None,
    date_to: date | None = None,
    category_id: str | None = None,
    account_id: uuid.UUID | None = None,
    min_amount: Decimal | None = None,
    max_amount: Decimal | None = None,
    search: str | None = None,
    sort_by: str = "date",
    sort_dir: str = "desc",
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    parsed_category_id = None
    uncategorized_only = False
    if category_id == "__uncategorized__":
        uncategorized_only = True
    elif category_id is not None:
        parsed_category_id = uuid.UUID(category_id)

    filters = TransactionFilter(
        date_from=date_from,
        date_to=date_to,
        category_id=parsed_category_id,
        account_id=account_id,
        min_amount=min_amount,
        max_amount=max_amount,
        search=search,
    )
    items, total = await get_transactions(
        db, current_user.id, filters, page=page, per_page=per_page,
        sort_by=sort_by, sort_dir=sort_dir,
        uncategorized_only=uncategorized_only,
    )
    total_pages = math.ceil(total / per_page) if total > 0 else 0
    return {
        "items": [TransactionRead.model_validate(item) for item in items],
        "total": total,
        "page": page,
        "per_page": per_page,
        "total_pages": total_pages,
    }


@router.get("/{transaction_id}", response_model=TransactionRead)
async def get_transaction_endpoint(
    transaction_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    transaction = await get_transaction(db, current_user.id, transaction_id)
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return transaction


@router.patch("/{transaction_id}", response_model=TransactionRead)
async def update_transaction_endpoint(
    transaction_id: uuid.UUID,
    data: TransactionUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    transaction = await update_transaction(db, current_user.id, transaction_id, data)
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return transaction


@router.delete("/{transaction_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_transaction_endpoint(
    transaction_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    deleted = await delete_transaction(db, current_user.id, transaction_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Transaction not found")
