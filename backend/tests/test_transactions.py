import uuid
from datetime import date

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.account import Account
from app.models.category import Category
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


async def _create_category(db: AsyncSession, user_id: uuid.UUID) -> Category:
    category = Category(
        user_id=user_id,
        name="Groceries",
        is_system=False,
    )
    db.add(category)
    await db.flush()
    await db.refresh(category)
    return category


async def test_create_transaction(client: AsyncClient, db_session: AsyncSession, test_user: User):
    account = await _create_account(db_session, test_user.id)

    response = await client.post(
        "/api/v1/transactions/",
        json={
            "account_id": str(account.id),
            "date": "2025-01-15",
            "amount": "42.50",
            "description": "Grocery shopping",
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["amount"] == "42.50"
    assert data["description"] == "Grocery shopping"
    assert data["source"] == "manual"
    assert data["user_id"] == str(test_user.id)


async def test_list_transactions(client: AsyncClient, db_session: AsyncSession, test_user: User):
    account = await _create_account(db_session, test_user.id)

    for i in range(3):
        await client.post(
            "/api/v1/transactions/",
            json={
                "account_id": str(account.id),
                "date": f"2025-01-{15 + i:02d}",
                "amount": "10.00",
                "description": f"Transaction {i}",
            },
        )

    response = await client.get("/api/v1/transactions/")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 3
    assert len(data["items"]) == 3


async def test_list_transactions_pagination(
    client: AsyncClient, db_session: AsyncSession, test_user: User
):
    account = await _create_account(db_session, test_user.id)

    for i in range(5):
        await client.post(
            "/api/v1/transactions/",
            json={
                "account_id": str(account.id),
                "date": f"2025-01-{15 + i:02d}",
                "amount": "10.00",
                "description": f"Transaction {i}",
            },
        )

    response = await client.get("/api/v1/transactions/?page=1&per_page=2")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 5
    assert len(data["items"]) == 2
    assert data["page"] == 1
    assert data["per_page"] == 2
    assert data["total_pages"] == 3


async def test_filter_transactions_by_date(
    client: AsyncClient, db_session: AsyncSession, test_user: User
):
    account = await _create_account(db_session, test_user.id)

    for day in [10, 15, 20, 25]:
        await client.post(
            "/api/v1/transactions/",
            json={
                "account_id": str(account.id),
                "date": f"2025-01-{day:02d}",
                "amount": "10.00",
                "description": f"Transaction on day {day}",
            },
        )

    response = await client.get(
        "/api/v1/transactions/?date_from=2025-01-14&date_to=2025-01-21"
    )
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 2


async def test_filter_transactions_by_category(
    client: AsyncClient, db_session: AsyncSession, test_user: User
):
    account = await _create_account(db_session, test_user.id)
    category = await _create_category(db_session, test_user.id)

    # Create one with category
    await client.post(
        "/api/v1/transactions/",
        json={
            "account_id": str(account.id),
            "category_id": str(category.id),
            "date": "2025-01-15",
            "amount": "10.00",
            "description": "With category",
        },
    )
    # Create one without category
    await client.post(
        "/api/v1/transactions/",
        json={
            "account_id": str(account.id),
            "date": "2025-01-16",
            "amount": "20.00",
            "description": "Without category",
        },
    )

    response = await client.get(
        f"/api/v1/transactions/?category_id={category.id}"
    )
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 1
    assert data["items"][0]["description"] == "With category"


async def test_filter_transactions_by_amount(
    client: AsyncClient, db_session: AsyncSession, test_user: User
):
    account = await _create_account(db_session, test_user.id)

    for amount in [5, 15, 25, 35]:
        await client.post(
            "/api/v1/transactions/",
            json={
                "account_id": str(account.id),
                "date": "2025-01-15",
                "amount": str(amount),
                "description": f"Amount {amount}",
            },
        )

    response = await client.get(
        "/api/v1/transactions/?min_amount=10&max_amount=30"
    )
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 2


async def test_search_transactions(
    client: AsyncClient, db_session: AsyncSession, test_user: User
):
    account = await _create_account(db_session, test_user.id)

    await client.post(
        "/api/v1/transactions/",
        json={
            "account_id": str(account.id),
            "date": "2025-01-15",
            "amount": "10.00",
            "description": "Whole Foods grocery run",
        },
    )
    await client.post(
        "/api/v1/transactions/",
        json={
            "account_id": str(account.id),
            "date": "2025-01-16",
            "amount": "20.00",
            "description": "Amazon purchase",
        },
    )

    response = await client.get("/api/v1/transactions/?search=grocery")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 1
    assert "grocery" in data["items"][0]["description"].lower()


async def test_update_transaction(
    client: AsyncClient, db_session: AsyncSession, test_user: User
):
    account = await _create_account(db_session, test_user.id)

    create_resp = await client.post(
        "/api/v1/transactions/",
        json={
            "account_id": str(account.id),
            "date": "2025-01-15",
            "amount": "42.50",
            "description": "Original description",
        },
    )
    txn_id = create_resp.json()["id"]

    response = await client.patch(
        f"/api/v1/transactions/{txn_id}",
        json={"amount": "99.99", "description": "Updated description"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["amount"] == "99.99"
    assert data["description"] == "Updated description"


async def test_delete_transaction(
    client: AsyncClient, db_session: AsyncSession, test_user: User
):
    account = await _create_account(db_session, test_user.id)

    create_resp = await client.post(
        "/api/v1/transactions/",
        json={
            "account_id": str(account.id),
            "date": "2025-01-15",
            "amount": "42.50",
            "description": "To be deleted",
        },
    )
    txn_id = create_resp.json()["id"]

    delete_resp = await client.delete(f"/api/v1/transactions/{txn_id}")
    assert delete_resp.status_code == 204

    get_resp = await client.get(f"/api/v1/transactions/{txn_id}")
    assert get_resp.status_code == 404


async def test_cannot_access_other_users_transaction(
    client: AsyncClient, db_session: AsyncSession, test_user: User
):
    # Create a second user
    other_user = User(
        id=uuid.uuid4(),
        auth_provider_id="other_clerk_id_456",
        email="other@example.com",
        display_name="Other User",
    )
    db_session.add(other_user)
    await db_session.flush()

    # Create an account and transaction for the other user
    other_account = Account(
        user_id=other_user.id,
        name="Other Account",
        account_type="checking",
    )
    db_session.add(other_account)
    await db_session.flush()
    await db_session.refresh(other_account)

    from app.models.transaction import Transaction

    txn = Transaction(
        user_id=other_user.id,
        account_id=other_account.id,
        date=date(2025, 1, 15),
        amount=50,
        description="Other user's transaction",
        source="manual",
    )
    db_session.add(txn)
    await db_session.flush()
    await db_session.refresh(txn)

    # Try to access with test_user (should 404)
    response = await client.get(f"/api/v1/transactions/{txn.id}")
    assert response.status_code == 404
