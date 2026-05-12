import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.account import Account
from app.schemas.account import AccountCreate, AccountUpdate


async def create_account(
    db: AsyncSession, user_id: uuid.UUID, data: AccountCreate
) -> Account:
    account = Account(
        user_id=user_id,
        **data.model_dump(),
    )
    db.add(account)
    await db.flush()
    await db.refresh(account)
    return account


async def get_accounts(db: AsyncSession, user_id: uuid.UUID) -> list[Account]:
    result = await db.execute(
        select(Account).where(Account.user_id == user_id).order_by(Account.name)
    )
    return list(result.scalars().all())


async def get_account(
    db: AsyncSession, user_id: uuid.UUID, account_id: uuid.UUID
) -> Account | None:
    result = await db.execute(
        select(Account).where(Account.id == account_id, Account.user_id == user_id)
    )
    return result.scalar_one_or_none()


async def update_account(
    db: AsyncSession, user_id: uuid.UUID, account_id: uuid.UUID, data: AccountUpdate
) -> Account | None:
    account = await get_account(db, user_id, account_id)
    if not account:
        return None
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(account, key, value)
    await db.flush()
    await db.refresh(account)
    return account


async def delete_account(
    db: AsyncSession, user_id: uuid.UUID, account_id: uuid.UUID
) -> bool:
    account = await get_account(db, user_id, account_id)
    if not account:
        return False
    await db.delete(account)
    await db.flush()
    return True
