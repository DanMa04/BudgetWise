import uuid

from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.account import Account
from app.models.plaid_item import PlaidItem
from app.models.transaction import Transaction
from app.models.user import User
from app.services.teller_service import MockTellerService


async def test_enrollment_config(client: AsyncClient):
    response = await client.post("/api/v1/teller/enrollment-config")
    assert response.status_code == 200
    data = response.json()
    assert "app_id" in data
    assert "environment" in data
    assert data["environment"] == "mock"


async def test_exchange_token_creates_item_and_accounts(
    client: AsyncClient, db_session: AsyncSession, test_user: User
):
    response = await client.post(
        "/api/v1/teller/exchange-token",
        json={
            "enrollment_id": "teller-enrollment-abc123",
            "institution_id": "teller_ins_1",
            "institution_name": "Teller Bank",
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["institution_id"] == "teller_ins_1"
    assert data["institution_name"] == "Teller Bank"
    assert data["status"] == "active"
    assert data["provider"] == "teller"

    result = await db_session.execute(
        select(Account).where(Account.user_id == test_user.id)
    )
    accounts = list(result.scalars().all())
    assert len(accounts) == 3

    account_names = {a.name for a in accounts}
    assert "Everyday Checking" in account_names
    assert "High Yield Savings" in account_names
    assert "Rewards Credit Card" in account_names

    for account in accounts:
        assert account.plaid_item_id is not None
        assert account.plaid_account_id is not None


async def test_sync_transactions(
    client: AsyncClient, db_session: AsyncSession, test_user: User
):
    response = await client.post(
        "/api/v1/teller/exchange-token",
        json={
            "enrollment_id": "teller-enrollment-abc123",
            "institution_id": "teller_ins_1",
            "institution_name": "Teller Bank",
        },
    )
    item_id = response.json()["id"]

    sync_response = await client.post(f"/api/v1/teller/items/{item_id}/sync")
    assert sync_response.status_code == 200
    sync_data = sync_response.json()
    assert sync_data["added"] >= 12
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


async def test_list_teller_items_only_shows_teller(
    client: AsyncClient, db_session: AsyncSession, test_user: User
):
    # Create a Plaid item (should NOT appear)
    plaid_item = PlaidItem(
        user_id=test_user.id,
        institution_id="ins_plaid",
        institution_name="Plaid Bank",
        access_token="access-plaid-test",
        item_id="item-plaid-test",
        status="active",
        provider="plaid",
    )
    db_session.add(plaid_item)

    # Create a Teller item (SHOULD appear)
    teller_item = PlaidItem(
        user_id=test_user.id,
        institution_id="ins_teller",
        institution_name="Teller Bank",
        access_token="teller-access-test",
        item_id="teller-enrollment-test",
        status="active",
        provider="teller",
    )
    db_session.add(teller_item)
    await db_session.flush()

    response = await client.get("/api/v1/teller/items")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["institution_name"] == "Teller Bank"
    assert data[0]["provider"] == "teller"


async def test_unlink_teller_institution(
    client: AsyncClient, db_session: AsyncSession, test_user: User
):
    response = await client.post(
        "/api/v1/teller/exchange-token",
        json={
            "enrollment_id": "teller-enrollment-abc123",
            "institution_id": "teller_ins_1",
            "institution_name": "Teller Bank",
        },
    )
    item_id = response.json()["id"]

    delete_response = await client.delete(f"/api/v1/teller/items/{item_id}")
    assert delete_response.status_code == 204

    result = await db_session.execute(
        select(PlaidItem).where(PlaidItem.id == uuid.UUID(item_id))
    )
    plaid_item = result.scalar_one()
    assert plaid_item.status == "disconnected"


async def test_mock_teller_service_returns_realistic_data():
    service = MockTellerService()

    link_token = await service.create_link_token(uuid.uuid4())
    assert isinstance(link_token, str)
    assert link_token.startswith("teller-enrollment-")

    token_data = await service.exchange_public_token("teller-enrollment-test")
    assert "access_token" in token_data
    assert "item_id" in token_data
    assert token_data["access_token"].startswith("teller-access-")

    accounts = await service.get_accounts(token_data["access_token"])
    assert len(accounts) == 3
    for account in accounts:
        assert "account_id" in account
        assert "name" in account
        assert "type" in account
        assert "subtype" in account
        assert "balance_current" in account
        assert "currency" in account

    sync_data = await service.sync_transactions(token_data["access_token"], None)
    assert len(sync_data["added"]) >= 12
    assert len(sync_data["added"]) <= 20
    assert isinstance(sync_data["modified"], list)
    assert isinstance(sync_data["removed"], list)
    assert sync_data["next_cursor"].startswith("teller-cursor-")
    assert sync_data["has_more"] is False

    for txn in sync_data["added"]:
        assert "transaction_id" in txn
        assert "date" in txn
        assert "amount" in txn
        assert "description" in txn
        assert txn["amount"] > 0

    institution = await service.get_institution("teller_ins_1")
    assert institution["institution_id"] == "teller_ins_1"
    assert institution["name"] == "Teller Bank"


async def test_user_isolation(
    client: AsyncClient, db_session: AsyncSession, test_user: User
):
    other_user = User(
        id=uuid.uuid4(),
        auth_provider_id="other_clerk_teller_456",
        email="other_teller@example.com",
        display_name="Other Teller User",
        currency_code="USD",
        timezone="America/New_York",
    )
    db_session.add(other_user)
    await db_session.flush()

    other_item = PlaidItem(
        user_id=other_user.id,
        institution_id="teller_ins_2",
        institution_name="Other Teller Bank",
        access_token="teller-access-other",
        item_id="teller-enrollment-other",
        status="active",
        provider="teller",
    )
    db_session.add(other_item)
    await db_session.flush()
    await db_session.refresh(other_item)

    # List should not show other user's items
    response = await client.get("/api/v1/teller/items")
    assert response.status_code == 200
    items = response.json()
    assert len(items) == 0

    # Sync should 404 for other user's item
    sync_response = await client.post(
        f"/api/v1/teller/items/{other_item.id}/sync"
    )
    assert sync_response.status_code == 404

    # Delete should 404 for other user's item
    delete_response = await client.delete(
        f"/api/v1/teller/items/{other_item.id}"
    )
    assert delete_response.status_code == 404
