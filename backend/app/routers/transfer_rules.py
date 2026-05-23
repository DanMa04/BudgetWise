import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.transfer_rule import TransferRule
from app.models.user import User
from app.schemas.transfer_rule import (
    TransferRuleCreate,
    TransferRuleRead,
    TransferRuleUpdate,
)

router = APIRouter(prefix="/transfer-rules", tags=["transfer-rules"])


@router.get("/", response_model=list[TransferRuleRead])
async def list_transfer_rules(
    source_category_id: uuid.UUID | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(TransferRule).where(TransferRule.user_id == current_user.id)
    if source_category_id:
        query = query.where(TransferRule.source_category_id == source_category_id)
    query = query.order_by(TransferRule.priority.desc())
    result = await db.execute(query)
    return list(result.scalars().all())


@router.post("/", response_model=TransferRuleRead, status_code=status.HTTP_201_CREATED)
async def create_transfer_rule(
    data: TransferRuleCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    rule = TransferRule(user_id=current_user.id, **data.model_dump())
    db.add(rule)
    await db.flush()
    await db.refresh(rule)
    return rule


@router.patch("/{rule_id}", response_model=TransferRuleRead)
async def update_transfer_rule(
    rule_id: uuid.UUID,
    data: TransferRuleUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(TransferRule).where(
            TransferRule.id == rule_id, TransferRule.user_id == current_user.id
        )
    )
    rule = result.scalar_one_or_none()
    if not rule:
        raise HTTPException(status_code=404, detail="Transfer rule not found")

    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(rule, key, value)
    await db.flush()
    await db.refresh(rule)
    return rule


@router.delete("/{rule_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_transfer_rule(
    rule_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(TransferRule).where(
            TransferRule.id == rule_id, TransferRule.user_id == current_user.id
        )
    )
    rule = result.scalar_one_or_none()
    if not rule:
        raise HTTPException(status_code=404, detail="Transfer rule not found")
    await db.delete(rule)
    await db.flush()
