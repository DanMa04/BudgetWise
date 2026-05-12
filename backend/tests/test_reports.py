import uuid
from datetime import date, timedelta

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.account import Account
from app.models.budget import Budget
from app.models.category import Category
from app.models.transaction import Transaction
from app.models.user import User


async def _create_account(db: AsyncSession, user_id: uuid.UUID) -> Account:
    account = Account(
        user_id=user_id,
        name="Test Checking",
        account_type="checking",
        currency_code="USD",
        current_balance=1000,
    )
    db.add(account)
    await db.flush()
    await db.refresh(account)
    return account


async def _create_category(
    db: AsyncSession,
    user_id: uuid.UUID,
    name: str = "Groceries",
    is_income: bool = False,
    color: str = "#FF0000",
    icon: str = "cart",
) -> Category:
    category = Category(
        user_id=user_id,
        name=name,
        is_income=is_income,
        is_system=False,
        color=color,
        icon=icon,
    )
    db.add(category)
    await db.flush()
    await db.refresh(category)
    return category


async def _create_transaction(
    db: AsyncSession,
    user_id: uuid.UUID,
    account_id: uuid.UUID,
    category_id: uuid.UUID,
    amount: float,
    txn_date: date,
    description: str = "Test Transaction",
) -> Transaction:
    txn = Transaction(
        user_id=user_id,
        account_id=account_id,
        category_id=category_id,
        date=txn_date,
        amount=amount,
        description=description,
        source="manual",
    )
    db.add(txn)
    await db.flush()
    await db.refresh(txn)
    return txn


async def test_spending_by_category(
    client: AsyncClient, db_session: AsyncSession, test_user: User
):
    account = await _create_account(db_session, test_user.id)
    cat1 = await _create_category(
        db_session, test_user.id, "Groceries", color="#FF0000", icon="cart"
    )
    cat2 = await _create_category(
        db_session, test_user.id, "Entertainment", color="#00FF00", icon="film"
    )

    today = date.today()
    await _create_transaction(db_session, test_user.id, account.id, cat1.id, 100, today)
    await _create_transaction(db_session, test_user.id, account.id, cat1.id, 50, today)
    await _create_transaction(db_session, test_user.id, account.id, cat2.id, 50, today)
    await db_session.commit()

    response = await client.get(
        "/api/v1/reports/spending-by-category",
        params={
            "start_date": (today - timedelta(days=1)).isoformat(),
            "end_date": today.isoformat(),
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2

    assert data[0]["category_name"] == "Groceries"
    assert data[0]["total_amount"] == 150.0
    assert data[0]["transaction_count"] == 2
    assert data[0]["percentage"] == 75.0

    assert data[1]["category_name"] == "Entertainment"
    assert data[1]["total_amount"] == 50.0
    assert data[1]["transaction_count"] == 1
    assert data[1]["percentage"] == 25.0


async def test_spending_by_category_empty(
    client: AsyncClient, db_session: AsyncSession, test_user: User
):
    today = date.today()
    response = await client.get(
        "/api/v1/reports/spending-by-category",
        params={"start_date": today.isoformat(), "end_date": today.isoformat()},
    )
    assert response.status_code == 200
    assert response.json() == []


async def test_spending_trends_monthly(
    client: AsyncClient, db_session: AsyncSession, test_user: User
):
    account = await _create_account(db_session, test_user.id)
    cat = await _create_category(db_session, test_user.id, "Food")

    today = date.today()
    last_month = (today.replace(day=1) - timedelta(days=1)).replace(day=15)

    await _create_transaction(db_session, test_user.id, account.id, cat.id, 100, today)
    await _create_transaction(db_session, test_user.id, account.id, cat.id, 200, last_month)
    await db_session.commit()

    response = await client.get(
        "/api/v1/reports/spending-trends",
        params={
            "start_date": (last_month - timedelta(days=1)).isoformat(),
            "end_date": today.isoformat(),
            "granularity": "monthly",
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    assert data[0]["total_amount"] == 200.0
    assert data[1]["total_amount"] == 100.0


async def test_spending_trends_daily(
    client: AsyncClient, db_session: AsyncSession, test_user: User
):
    account = await _create_account(db_session, test_user.id)
    cat = await _create_category(db_session, test_user.id, "Food")

    today = date.today()
    yesterday = today - timedelta(days=1)

    await _create_transaction(db_session, test_user.id, account.id, cat.id, 50, today)
    await _create_transaction(db_session, test_user.id, account.id, cat.id, 75, yesterday)
    await db_session.commit()

    response = await client.get(
        "/api/v1/reports/spending-trends",
        params={
            "start_date": yesterday.isoformat(),
            "end_date": today.isoformat(),
            "granularity": "daily",
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    assert data[0]["period"] == yesterday.isoformat()
    assert data[0]["total_amount"] == 75.0
    assert data[1]["period"] == today.isoformat()
    assert data[1]["total_amount"] == 50.0


async def test_budget_vs_actual(
    client: AsyncClient, db_session: AsyncSession, test_user: User
):
    account = await _create_account(db_session, test_user.id)
    cat = await _create_category(db_session, test_user.id, "Groceries", color="#FF0000")

    today = date.today()
    start_date = today.replace(day=1)

    budget = Budget(
        user_id=test_user.id,
        category_id=cat.id,
        name="Grocery Budget",
        amount=500,
        period_type="monthly",
        start_date=start_date,
        is_active=True,
    )
    db_session.add(budget)
    await db_session.flush()

    await _create_transaction(db_session, test_user.id, account.id, cat.id, 150, today)
    await _create_transaction(db_session, test_user.id, account.id, cat.id, 100, today)
    await db_session.commit()

    response = await client.get(
        "/api/v1/reports/budget-vs-actual",
        params={"start_date": start_date.isoformat(), "end_date": today.isoformat()},
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1

    item = data[0]
    assert item["category_name"] == "Groceries"
    assert item["budgeted_amount"] == 500.0
    assert item["actual_amount"] == 250.0
    assert item["difference"] == 250.0
    assert item["percentage_used"] == 50.0


async def test_monthly_comparison(
    client: AsyncClient, db_session: AsyncSession, test_user: User
):
    account = await _create_account(db_session, test_user.id)
    expense_cat = await _create_category(db_session, test_user.id, "Food", is_income=False)
    income_cat = await _create_category(db_session, test_user.id, "Salary", is_income=True)

    today = date.today()

    await _create_transaction(db_session, test_user.id, account.id, expense_cat.id, 300, today)
    await _create_transaction(db_session, test_user.id, account.id, income_cat.id, 1000, today)
    await db_session.commit()

    response = await client.get(
        "/api/v1/reports/monthly-comparison", params={"months": 1}
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1

    current_month = f"{today.year}-{today.month:02d}"
    month_data = next(m for m in data if m["month"] == current_month)
    assert month_data["income"] == 1000.0
    assert month_data["expenses"] == 300.0
    assert month_data["net"] == 700.0


async def test_income_vs_expense(
    client: AsyncClient, db_session: AsyncSession, test_user: User
):
    account = await _create_account(db_session, test_user.id)
    expense_cat = await _create_category(db_session, test_user.id, "Food", is_income=False)
    income_cat = await _create_category(db_session, test_user.id, "Salary", is_income=True)

    today = date.today()

    await _create_transaction(db_session, test_user.id, account.id, expense_cat.id, 200, today)
    await _create_transaction(db_session, test_user.id, account.id, income_cat.id, 1000, today)
    await db_session.commit()

    response = await client.get(
        "/api/v1/reports/income-vs-expense",
        params={
            "start_date": (today - timedelta(days=1)).isoformat(),
            "end_date": today.isoformat(),
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1

    item = data[0]
    assert item["income"] == 1000.0
    assert item["expenses"] == 200.0
    assert item["savings_rate"] == 80.0


async def test_top_merchants(
    client: AsyncClient, db_session: AsyncSession, test_user: User
):
    account = await _create_account(db_session, test_user.id)
    cat = await _create_category(db_session, test_user.id, "Food")

    today = date.today()

    await _create_transaction(
        db_session, test_user.id, account.id, cat.id, 100, today, "Whole Foods"
    )
    await _create_transaction(
        db_session, test_user.id, account.id, cat.id, 80, today, "Whole Foods"
    )
    await _create_transaction(
        db_session, test_user.id, account.id, cat.id, 50, today, "Trader Joes"
    )
    await db_session.commit()

    response = await client.get(
        "/api/v1/reports/top-merchants",
        params={
            "start_date": (today - timedelta(days=1)).isoformat(),
            "end_date": today.isoformat(),
            "limit": 10,
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2

    assert data[0]["description"] == "whole foods"
    assert data[0]["total_amount"] == 180.0
    assert data[0]["transaction_count"] == 2

    assert data[1]["description"] == "trader joes"
    assert data[1]["total_amount"] == 50.0
    assert data[1]["transaction_count"] == 1


async def test_date_range_filtering(
    client: AsyncClient, db_session: AsyncSession, test_user: User
):
    account = await _create_account(db_session, test_user.id)
    cat = await _create_category(db_session, test_user.id, "Food")

    today = date.today()
    in_range = today - timedelta(days=5)
    out_of_range = today - timedelta(days=60)

    await _create_transaction(
        db_session, test_user.id, account.id, cat.id, 100, in_range, "In Range"
    )
    await _create_transaction(
        db_session, test_user.id, account.id, cat.id, 200, out_of_range, "Out of Range"
    )
    await db_session.commit()

    response = await client.get(
        "/api/v1/reports/spending-by-category",
        params={
            "start_date": (today - timedelta(days=10)).isoformat(),
            "end_date": today.isoformat(),
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["total_amount"] == 100.0


async def test_user_isolation(
    client: AsyncClient, db_session: AsyncSession, test_user: User
):
    other_user = User(
        id=uuid.uuid4(),
        auth_provider_id="other_clerk_id",
        email="other@example.com",
        display_name="Other User",
        currency_code="USD",
        timezone="America/New_York",
    )
    db_session.add(other_user)
    await db_session.flush()

    account = await _create_account(db_session, other_user.id)
    cat = await _create_category(db_session, other_user.id, "Other Food")

    today = date.today()
    await _create_transaction(
        db_session, other_user.id, account.id, cat.id, 500, today
    )
    await db_session.commit()

    response = await client.get(
        "/api/v1/reports/spending-by-category",
        params={
            "start_date": (today - timedelta(days=1)).isoformat(),
            "end_date": today.isoformat(),
        },
    )
    assert response.status_code == 200
    assert response.json() == []
