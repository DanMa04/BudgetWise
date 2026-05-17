import uuid
from datetime import date

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.account import Account
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
    db: AsyncSession, user_id: uuid.UUID, name: str = "Groceries"
) -> Category:
    category = Category(
        user_id=user_id,
        name=name,
        is_system=False,
    )
    db.add(category)
    await db.flush()
    await db.refresh(category)
    return category


async def test_create_budget(client: AsyncClient, db_session: AsyncSession, test_user: User):
    category = await _create_category(db_session, test_user.id)

    response = await client.post(
        "/api/v1/budgets/",
        json={
            "category_id": str(category.id),
            "name": "Grocery Budget",
            "amount": "500.00",
            "start_date": "2025-01-01",
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Grocery Budget"
    assert data["amount"] == "500.00"
    assert data["period_type"] == "monthly"
    assert data["is_active"] is True


async def test_list_budgets_with_spend(
    client: AsyncClient, db_session: AsyncSession, test_user: User
):
    category = await _create_category(db_session, test_user.id)
    account = await _create_account(db_session, test_user.id)

    # Create a budget
    today = date.today()
    start_date = today.replace(day=1)

    await client.post(
        "/api/v1/budgets/",
        json={
            "category_id": str(category.id),
            "name": "Grocery Budget",
            "amount": "500.00",
            "start_date": start_date.isoformat(),
        },
    )

    # Create transactions in that category for this month
    txn1 = Transaction(
        user_id=test_user.id,
        account_id=account.id,
        category_id=category.id,
        date=today,
        amount=-100,
        description="Groceries 1",
        source="manual",
    )
    txn2 = Transaction(
        user_id=test_user.id,
        account_id=account.id,
        category_id=category.id,
        date=today,
        amount=-50,
        description="Groceries 2",
        source="manual",
    )
    db_session.add_all([txn1, txn2])
    await db_session.flush()

    response = await client.get("/api/v1/budgets/")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    budget = data[0]
    assert budget["spent_amount"] == 150.0
    assert budget["remaining_amount"] == 350.0
    assert budget["percentage_used"] == 30.0


async def test_budget_summary(
    client: AsyncClient, db_session: AsyncSession, test_user: User
):
    cat1 = await _create_category(db_session, test_user.id, name="Groceries")
    cat2 = await _create_category(db_session, test_user.id, name="Entertainment")
    account = await _create_account(db_session, test_user.id)

    today = date.today()
    start_date = today.replace(day=1)

    # Create two budgets
    await client.post(
        "/api/v1/budgets/",
        json={
            "category_id": str(cat1.id),
            "name": "Grocery Budget",
            "amount": "500.00",
            "start_date": start_date.isoformat(),
        },
    )
    await client.post(
        "/api/v1/budgets/",
        json={
            "category_id": str(cat2.id),
            "name": "Entertainment Budget",
            "amount": "200.00",
            "start_date": start_date.isoformat(),
        },
    )

    # Add spend to groceries
    txn = Transaction(
        user_id=test_user.id,
        account_id=account.id,
        category_id=cat1.id,
        date=today,
        amount=-100,
        description="Grocery spend",
        source="manual",
    )
    db_session.add(txn)
    await db_session.flush()

    response = await client.get("/api/v1/budgets/summary")
    assert response.status_code == 200
    data = response.json()
    assert data["total_budgeted"] == 700.0
    assert data["total_spent"] == 100.0
    assert data["total_remaining"] == 600.0
    assert len(data["budgets"]) == 2


async def test_update_budget(client: AsyncClient, db_session: AsyncSession, test_user: User):
    category = await _create_category(db_session, test_user.id)

    create_resp = await client.post(
        "/api/v1/budgets/",
        json={
            "category_id": str(category.id),
            "name": "Grocery Budget",
            "amount": "500.00",
            "start_date": "2025-01-01",
        },
    )
    budget_id = create_resp.json()["id"]

    response = await client.patch(
        f"/api/v1/budgets/{budget_id}",
        json={"amount": "600.00", "name": "Updated Budget"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["amount"] == "600.00"
    assert data["name"] == "Updated Budget"


async def test_delete_budget(client: AsyncClient, db_session: AsyncSession, test_user: User):
    category = await _create_category(db_session, test_user.id)

    create_resp = await client.post(
        "/api/v1/budgets/",
        json={
            "category_id": str(category.id),
            "name": "Grocery Budget",
            "amount": "500.00",
            "start_date": "2025-01-01",
        },
    )
    budget_id = create_resp.json()["id"]

    delete_resp = await client.delete(f"/api/v1/budgets/{budget_id}")
    assert delete_resp.status_code == 204

    get_resp = await client.get(f"/api/v1/budgets/{budget_id}")
    assert get_resp.status_code == 404


async def test_budget_no_overspend_error(
    client: AsyncClient, db_session: AsyncSession, test_user: User
):
    """Budgets should track overspend, not prevent transactions."""
    category = await _create_category(db_session, test_user.id)
    account = await _create_account(db_session, test_user.id)

    today = date.today()
    start_date = today.replace(day=1)

    # Create a small budget
    await client.post(
        "/api/v1/budgets/",
        json={
            "category_id": str(category.id),
            "name": "Small Budget",
            "amount": "50.00",
            "start_date": start_date.isoformat(),
        },
    )

    # Create a transaction that exceeds the budget - should still succeed
    response = await client.post(
        "/api/v1/transactions/",
        json={
            "account_id": str(account.id),
            "category_id": str(category.id),
            "date": today.isoformat(),
            "amount": "-100.00",
            "description": "Over budget purchase",
        },
    )
    assert response.status_code == 201

    # Budget should show overspend
    budgets_resp = await client.get("/api/v1/budgets/")
    data = budgets_resp.json()
    assert len(data) == 1
    assert data[0]["spent_amount"] == 100.0
    assert data[0]["remaining_amount"] == -50.0
    assert data[0]["percentage_used"] == 200.0
