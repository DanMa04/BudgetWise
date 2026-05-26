import uuid
from decimal import Decimal

from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.transaction import Transaction
from app.schemas.transaction import TransactionCreate, TransactionFilter, TransactionUpdate


async def create_transaction(
    db: AsyncSession, user_id: uuid.UUID, data: TransactionCreate
) -> Transaction:
    transaction = Transaction(
        user_id=user_id,
        source="manual",
        **data.model_dump(),
    )
    db.add(transaction)
    await db.flush()
    await db.refresh(transaction)
    return transaction


async def get_transactions(
    db: AsyncSession,
    user_id: uuid.UUID,
    filters: TransactionFilter,
    page: int = 1,
    per_page: int = 50,
    sort_by: str = "date",
    sort_dir: str = "desc",
    uncategorized_only: bool = False,
) -> tuple[list[Transaction], int, Decimal, Decimal]:
    base_query = select(Transaction).where(Transaction.user_id == user_id)
    count_query = select(func.count()).select_from(Transaction).where(
        Transaction.user_id == user_id
    )
    sum_query = select(
        func.coalesce(
            func.sum(case((Transaction.amount >= 0, Transaction.amount), else_=0)), 0
        ).label("income_sum"),
        func.coalesce(
            func.sum(case((Transaction.amount < 0, Transaction.amount), else_=0)), 0
        ).label("expense_sum"),
    ).where(Transaction.user_id == user_id)

    if uncategorized_only:
        base_query = base_query.where(Transaction.category_id.is_(None))
        count_query = count_query.where(Transaction.category_id.is_(None))
        sum_query = sum_query.where(Transaction.category_id.is_(None))

    # Apply filters
    if filters.date_from is not None:
        base_query = base_query.where(Transaction.date >= filters.date_from)
        count_query = count_query.where(Transaction.date >= filters.date_from)
        sum_query = sum_query.where(Transaction.date >= filters.date_from)
    if filters.date_to is not None:
        base_query = base_query.where(Transaction.date <= filters.date_to)
        count_query = count_query.where(Transaction.date <= filters.date_to)
        sum_query = sum_query.where(Transaction.date <= filters.date_to)
    if filters.category_id is not None:
        base_query = base_query.where(Transaction.category_id == filters.category_id)
        count_query = count_query.where(Transaction.category_id == filters.category_id)
        sum_query = sum_query.where(Transaction.category_id == filters.category_id)
    if filters.account_id is not None:
        base_query = base_query.where(Transaction.account_id == filters.account_id)
        count_query = count_query.where(Transaction.account_id == filters.account_id)
        sum_query = sum_query.where(Transaction.account_id == filters.account_id)
    if filters.min_amount is not None:
        base_query = base_query.where(Transaction.amount >= filters.min_amount)
        count_query = count_query.where(Transaction.amount >= filters.min_amount)
        sum_query = sum_query.where(Transaction.amount >= filters.min_amount)
    if filters.max_amount is not None:
        base_query = base_query.where(Transaction.amount <= filters.max_amount)
        count_query = count_query.where(Transaction.amount <= filters.max_amount)
        sum_query = sum_query.where(Transaction.amount <= filters.max_amount)
    if filters.search is not None:
        search_pattern = f"%{filters.search}%"
        base_query = base_query.where(Transaction.description.ilike(search_pattern))
        count_query = count_query.where(Transaction.description.ilike(search_pattern))
        sum_query = sum_query.where(Transaction.description.ilike(search_pattern))

    # Get total count and sums over the full filtered set (not just this page)
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    sum_result = await db.execute(sum_query)
    sums = sum_result.one()
    income_sum: Decimal = sums.income_sum or Decimal(0)
    expense_sum: Decimal = sums.expense_sum or Decimal(0)

    # Apply sorting
    sort_column = getattr(Transaction, sort_by, Transaction.date)
    if sort_dir == "asc":
        base_query = base_query.order_by(sort_column.asc())
    else:
        base_query = base_query.order_by(sort_column.desc())

    # Apply pagination
    offset = (page - 1) * per_page
    base_query = base_query.offset(offset).limit(per_page)

    result = await db.execute(base_query)
    items = list(result.scalars().all())

    return items, total, income_sum, expense_sum


async def get_transaction(
    db: AsyncSession, user_id: uuid.UUID, transaction_id: uuid.UUID
) -> Transaction | None:
    result = await db.execute(
        select(Transaction).where(
            Transaction.id == transaction_id, Transaction.user_id == user_id
        )
    )
    return result.scalar_one_or_none()


async def update_transaction(
    db: AsyncSession,
    user_id: uuid.UUID,
    transaction_id: uuid.UUID,
    data: TransactionUpdate,
) -> Transaction | None:
    transaction = await get_transaction(db, user_id, transaction_id)
    if not transaction:
        return None
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(transaction, key, value)
    await db.flush()
    await db.refresh(transaction)
    return transaction


async def delete_transaction(
    db: AsyncSession, user_id: uuid.UUID, transaction_id: uuid.UUID
) -> bool:
    transaction = await get_transaction(db, user_id, transaction_id)
    if not transaction:
        return False
    await db.delete(transaction)
    await db.flush()
    return True
