import uuid

from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.account import Account
from app.models.plaid_item import PlaidItem
from app.models.transaction import Transaction
from app.models.user import User
from app.services.plaid_service import MockPlaidService


async def test_create_link_token(client: AsyncClient):
    response = await client.post("/api/v1/plaid/link-token")
    assert response.status_code == 200
    data = response.json()
    assert "link_token" in data
    assert data["link_token"].startswith("link-mock-")


async def test_exchange_token_creates_item_and_accounts(
    client: AsyncClient, db_session: AsyncSession, test_user: User
):
    response = await client.post(
        "/api/v1/plaid/exchange-token",
        json={
            "public_token": "public-mock-token",
            "institution_id": "ins_1",
            "institution_name": "Mock Bank",
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["institution_id"] == "ins_1"
    assert data["institution_name"] == "Mock Bank"
    assert data["status"] == "active"

    result = await db_session.execute(
        select(Account).where(Account.user_id == test_user.id)
    )
    accounts = list(result.scalars().all())
    assert len(accounts) == 4

    account_names = {a.name for a in accounts}
    assert "Main Checking" in account_names
    assert "Savings Account" in account_names
    assert "Credit Card" in account_names
    assert "Investment Portfolio" in account_names

    for account in accounts:
        assert account.plaid_item_id is not None
        assert account.plaid_account_id is not None


async def test_list_plaid_items(
    client: AsyncClient, db_session: AsyncSession, test_user: User
):
    plaid_item = PlaidItem(
        user_id=test_user.id,
        institution_id="ins_1",
        institution_name="Mock Bank",
        access_token="access-test",
        item_id="item-test",
        status="active",
    )
    db_session.add(plaid_item)
    await db_session.flush()

    response = await client.get("/api/v1/plaid/items")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["institution_name"] == "Mock Bank"
    assert data[0]["status"] == "active"


async def test_sync_transactions(
    client: AsyncClient, db_session: AsyncSession, test_user: User
):
    response = await client.post(
        "/api/v1/plaid/exchange-token",
        json={
            "public_token": "public-mock-token",
            "institution_id": "ins_1",
            "institution_name": "Mock Bank",
        },
    )
    item_id = response.json()["id"]

    sync_response = await client.post(f"/api/v1/plaid/items/{item_id}/sync")
    assert sync_response.status_code == 200
    sync_data = sync_response.json()
    assert sync_data["added"] >= 15
    assert sync_data["modified"] == 0
    assert sync_data["removed"] == 0

    result = await db_session.execute(
        select(Transaction).where(
            Transaction.user_id == test_user.id,
            Transaction.source == "plaid",
        )
    )
    transactions = list(result.scalars().all())
    assert len(transactions) == sync_data["added"]


async def test_sync_updates_cursor(
    client: AsyncClient, db_session: AsyncSession, test_user: User
):
    response = await client.post(
        "/api/v1/plaid/exchange-token",
        json={
            "public_token": "public-mock-token",
            "institution_id": "ins_1",
            "institution_name": "Mock Bank",
        },
    )
    item_id = response.json()["id"]

    await client.post(f"/api/v1/plaid/items/{item_id}/sync")

    result = await db_session.execute(
        select(PlaidItem).where(PlaidItem.id == uuid.UUID(item_id))
    )
    plaid_item = result.scalar_one()
    assert plaid_item.sync_cursor is not None
    assert plaid_item.sync_cursor.startswith("cursor-mock-")
    assert plaid_item.last_synced_at is not None


async def test_sync_updates_balances(
    client: AsyncClient, db_session: AsyncSession, test_user: User
):
    response = await client.post(
        "/api/v1/plaid/exchange-token",
        json={
            "public_token": "public-mock-token",
            "institution_id": "ins_1",
            "institution_name": "Mock Bank",
        },
    )
    item_id = response.json()["id"]

    result = await db_session.execute(
        select(Account).where(Account.plaid_item_id == uuid.UUID(item_id))
    )
    accounts = list(result.scalars().all())
    assert len(accounts) > 0

    await client.post(f"/api/v1/plaid/items/{item_id}/sync")

    for account in accounts:
        await db_session.refresh(account)
        assert account.current_balance is not None


async def test_unlink_institution(
    client: AsyncClient, db_session: AsyncSession, test_user: User
):
    response = await client.post(
        "/api/v1/plaid/exchange-token",
        json={
            "public_token": "public-mock-token",
            "institution_id": "ins_1",
            "institution_name": "Mock Bank",
        },
    )
    item_id = response.json()["id"]

    delete_response = await client.delete(f"/api/v1/plaid/items/{item_id}")
    assert delete_response.status_code == 204

    result = await db_session.execute(
        select(PlaidItem).where(PlaidItem.id == uuid.UUID(item_id))
    )
    plaid_item = result.scalar_one()
    assert plaid_item.status == "disconnected"


async def test_mock_service_returns_realistic_data():
    service = MockPlaidService()

    link_token = await service.create_link_token(uuid.uuid4())
    assert isinstance(link_token, str)
    assert link_token.startswith("link-mock-")

    token_data = await service.exchange_public_token("test-public-token")
    assert "access_token" in token_data
    assert "item_id" in token_data

    accounts = await service.get_accounts(token_data["access_token"])
    assert len(accounts) == 4
    for account in accounts:
        assert "account_id" in account
        assert "name" in account
        assert "type" in account
        assert "subtype" in account
        assert "balance_current" in account
        assert "currency" in account

    sync_data = await service.sync_transactions(token_data["access_token"], None)
    assert len(sync_data["added"]) >= 15
    assert len(sync_data["added"]) <= 25
    assert isinstance(sync_data["modified"], list)
    assert isinstance(sync_data["removed"], list)
    assert sync_data["next_cursor"].startswith("cursor-mock-")
    assert sync_data["has_more"] is False

    for txn in sync_data["added"]:
        assert "transaction_id" in txn
        assert "date" in txn
        assert "amount" in txn
        assert "description" in txn
        assert txn["amount"] > 0

    institution = await service.get_institution("ins_1")
    assert institution["institution_id"] == "ins_1"
    assert institution["name"] == "Mock Bank"


async def test_user_isolation(
    client: AsyncClient, db_session: AsyncSession, test_user: User
):
    other_user = User(
        id=uuid.uuid4(),
        auth_provider_id="other_clerk_id_456",
        email="other@example.com",
        display_name="Other User",
        currency_code="USD",
        timezone="America/New_York",
    )
    db_session.add(other_user)
    await db_session.flush()

    other_item = PlaidItem(
        user_id=other_user.id,
        institution_id="ins_2",
        institution_name="Other Bank",
        access_token="access-other",
        item_id="item-other",
        status="active",
    )
    db_session.add(other_item)
    await db_session.flush()
    await db_session.refresh(other_item)

    response = await client.get("/api/v1/plaid/items")
    assert response.status_code == 200
    items = response.json()
    assert len(items) == 0

    sync_response = await client.post(
        f"/api/v1/plaid/items/{other_item.id}/sync"
    )
    assert sync_response.status_code == 404

    delete_response = await client.delete(
        f"/api/v1/plaid/items/{other_item.id}"
    )
    assert delete_response.status_code == 404
