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


async def _create_transaction(
    db: AsyncSession,
    user_id: uuid.UUID,
    account_id: uuid.UUID,
    description: str = "Test transaction",
    category_id: uuid.UUID | None = None,
) -> Transaction:
    txn = Transaction(
        user_id=user_id,
        account_id=account_id,
        date=date(2025, 1, 15),
        amount=42.50,
        description=description,
        source="manual",
        category_id=category_id,
    )
    db.add(txn)
    await db.flush()
    await db.refresh(txn)
    return txn


async def test_create_rule(
    client: AsyncClient, db_session: AsyncSession, test_user: User
):
    category = await _create_category(db_session, test_user.id)

    response = await client.post(
        "/api/v1/categorization/rules",
        json={
            "category_id": str(category.id),
            "rule_type": "contains",
            "pattern": "amazon",
            "priority": 5,
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["pattern"] == "amazon"
    assert data["rule_type"] == "contains"
    assert data["priority"] == 5
    assert data["is_active"] is True
    assert data["created_by"] == "user"
    assert data["match_count"] == 0
    assert data["user_id"] == str(test_user.id)


async def test_list_rules(
    client: AsyncClient, db_session: AsyncSession, test_user: User
):
    cat1 = await _create_category(db_session, test_user.id, "Groceries")
    cat2 = await _create_category(db_session, test_user.id, "Shopping")

    await client.post(
        "/api/v1/categorization/rules",
        json={
            "category_id": str(cat1.id),
            "rule_type": "contains",
            "pattern": "whole foods",
        },
    )
    await client.post(
        "/api/v1/categorization/rules",
        json={
            "category_id": str(cat2.id),
            "rule_type": "contains",
            "pattern": "amazon",
        },
    )

    response = await client.get("/api/v1/categorization/rules")
    assert response.status_code == 200
    assert len(response.json()) == 2

    response = await client.get(
        f"/api/v1/categorization/rules?category_id={cat1.id}"
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["pattern"] == "whole foods"


async def test_rule_exact_match(
    client: AsyncClient, db_session: AsyncSession, test_user: User
):
    category = await _create_category(db_session, test_user.id)

    await client.post(
        "/api/v1/categorization/rules",
        json={
            "category_id": str(category.id),
            "rule_type": "exact",
            "pattern": "Whole Foods Market",
        },
    )

    response = await client.post(
        "/api/v1/categorization/predict",
        json={"description": "Whole Foods Market"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["category_id"] == str(category.id)
    assert data["confidence"] == 1.0
    assert data["source"] == "rule"


async def test_rule_contains_match(
    client: AsyncClient, db_session: AsyncSession, test_user: User
):
    category = await _create_category(db_session, test_user.id)

    await client.post(
        "/api/v1/categorization/rules",
        json={
            "category_id": str(category.id),
            "rule_type": "contains",
            "pattern": "starbucks",
        },
    )

    response = await client.post(
        "/api/v1/categorization/predict",
        json={"description": "POS DEBIT STARBUCKS #1234"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["category_id"] == str(category.id)
    assert data["source"] == "rule"


async def test_rule_starts_with_match(
    client: AsyncClient, db_session: AsyncSession, test_user: User
):
    category = await _create_category(db_session, test_user.id)

    await client.post(
        "/api/v1/categorization/rules",
        json={
            "category_id": str(category.id),
            "rule_type": "starts_with",
            "pattern": "CHECKCARD",
        },
    )

    response = await client.post(
        "/api/v1/categorization/predict",
        json={"description": "CHECKCARD 1234 AMAZON.COM"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["category_id"] == str(category.id)
    assert data["source"] == "rule"


async def test_rule_priority_order(
    client: AsyncClient, db_session: AsyncSession, test_user: User
):
    cat_low = await _create_category(db_session, test_user.id, "Low Priority")
    cat_high = await _create_category(db_session, test_user.id, "High Priority")

    await client.post(
        "/api/v1/categorization/rules",
        json={
            "category_id": str(cat_low.id),
            "rule_type": "contains",
            "pattern": "amazon",
            "priority": 1,
        },
    )
    await client.post(
        "/api/v1/categorization/rules",
        json={
            "category_id": str(cat_high.id),
            "rule_type": "contains",
            "pattern": "amazon",
            "priority": 10,
        },
    )

    response = await client.post(
        "/api/v1/categorization/predict",
        json={"description": "Amazon.com purchase"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["category_id"] == str(cat_high.id)


async def test_predict_no_model(
    client: AsyncClient, db_session: AsyncSession, test_user: User
):
    response = await client.post(
        "/api/v1/categorization/predict",
        json={"description": "Some random purchase"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["category_id"] is None
    assert data["confidence"] == 0.0
    assert data["source"] == "ml"


async def test_record_correction(
    client: AsyncClient, db_session: AsyncSession, test_user: User
):
    account = await _create_account(db_session, test_user.id)
    category = await _create_category(db_session, test_user.id)
    txn = await _create_transaction(db_session, test_user.id, account.id)

    response = await client.post(
        f"/api/v1/categorization/correct/{txn.id}",
        json={"category_id": str(category.id)},
    )
    assert response.status_code == 204

    get_resp = await client.get(f"/api/v1/transactions/{txn.id}")
    assert get_resp.status_code == 200
    data = get_resp.json()
    assert data["category_id"] == str(category.id)
    assert data["category_source"] == "manual"
    assert float(data["category_confidence"]) == 1.0


async def test_correction_creates_rule(
    client: AsyncClient, db_session: AsyncSession, test_user: User
):
    account = await _create_account(db_session, test_user.id)
    category = await _create_category(db_session, test_user.id)
    txn = await _create_transaction(
        db_session, test_user.id, account.id, description="CHECKCARD 1234 AMAZON.COM"
    )

    response = await client.post(
        f"/api/v1/categorization/correct/{txn.id}",
        json={"category_id": str(category.id), "create_rule": True},
    )
    assert response.status_code == 204

    rules_resp = await client.get("/api/v1/categorization/rules")
    assert rules_resp.status_code == 200
    rules = rules_resp.json()
    assert len(rules) == 1
    assert rules[0]["rule_type"] == "merchant"
    assert rules[0]["category_id"] == str(category.id)


async def test_bulk_categorize(
    client: AsyncClient, db_session: AsyncSession, test_user: User
):
    account = await _create_account(db_session, test_user.id)
    category = await _create_category(db_session, test_user.id)

    txn_ids = []
    for i in range(3):
        txn = await _create_transaction(
            db_session, test_user.id, account.id, description=f"Transaction {i}"
        )
        txn_ids.append(str(txn.id))

    response = await client.post(
        "/api/v1/categorization/bulk-categorize",
        json={
            "transaction_ids": txn_ids,
            "category_id": str(category.id),
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["updated"] == 3


async def test_train_insufficient_data(
    client: AsyncClient, db_session: AsyncSession, test_user: User
):
    response = await client.post("/api/v1/categorization/train")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "insufficient_data"
    assert data["minimum_required"] == 50


async def test_user_isolation(
    client: AsyncClient, db_session: AsyncSession, test_user: User
):
    other_user = User(
        id=uuid.uuid4(),
        auth_provider_id="other_clerk_id_456",
        email="other@example.com",
        display_name="Other User",
    )
    db_session.add(other_user)
    await db_session.flush()

    other_category = Category(
        user_id=other_user.id,
        name="Other Category",
        is_system=False,
    )
    db_session.add(other_category)
    await db_session.flush()
    await db_session.refresh(other_category)

    from app.models.categorization_rule import CategorizationRule

    other_rule = CategorizationRule(
        user_id=other_user.id,
        category_id=other_category.id,
        rule_type="contains",
        pattern="secret",
        created_by="user",
    )
    db_session.add(other_rule)
    await db_session.flush()
    await db_session.refresh(other_rule)

    response = await client.get("/api/v1/categorization/rules")
    assert response.status_code == 200
    assert len(response.json()) == 0

    response = await client.patch(
        f"/api/v1/categorization/rules/{other_rule.id}",
        json={"priority": 99},
    )
    assert response.status_code == 404

    response = await client.delete(
        f"/api/v1/categorization/rules/{other_rule.id}"
    )
    assert response.status_code == 404
