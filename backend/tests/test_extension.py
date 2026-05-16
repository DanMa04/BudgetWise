import uuid
from datetime import date
from decimal import Decimal

from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.main import app
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


async def _create_budget(
    db: AsyncSession,
    user_id: uuid.UUID,
    category_id: uuid.UUID,
    name: str,
    amount: Decimal,
) -> Budget:
    today = date.today()
    start_date = today.replace(day=1)
    budget = Budget(
        user_id=user_id,
        category_id=category_id,
        name=name,
        amount=amount,
        period_type="monthly",
        start_date=start_date,
    )
    db.add(budget)
    await db.flush()
    await db.refresh(budget)
    return budget


async def _create_transaction(
    db: AsyncSession,
    user_id: uuid.UUID,
    account_id: uuid.UUID,
    category_id: uuid.UUID,
    amount: float,
    description: str = "Test txn",
) -> Transaction:
    txn = Transaction(
        user_id=user_id,
        account_id=account_id,
        category_id=category_id,
        date=date.today(),
        amount=amount,
        description=description,
        source="manual",
    )
    db.add(txn)
    await db.flush()
    await db.refresh(txn)
    return txn


async def test_budget_check_returns_active_budgets(
    client: AsyncClient, db_session: AsyncSession, test_user: User
):
    """Budget check returns all active budgets with spend data."""
    category = await _create_category(db_session, test_user.id)
    account = await _create_account(db_session, test_user.id)
    await _create_budget(
        db_session, test_user.id, category.id, "Grocery Budget", Decimal("500.00")
    )
    await _create_transaction(
        db_session, test_user.id, account.id, category.id, 150.0
    )

    response = await client.get("/api/v1/extension/budget-check")
    assert response.status_code == 200
    data = response.json()

    assert Decimal(data["total_budgeted"]) == Decimal("500.00")
    assert Decimal(data["total_spent"]) == Decimal("150.00")
    assert Decimal(data["total_remaining"]) == Decimal("350.00")
    assert len(data["budgets"]) == 1

    budget = data["budgets"][0]
    assert budget["name"] == "Grocery Budget"
    assert budget["category_name"] == "Groceries"
    assert Decimal(budget["budgeted"]) == Decimal("500.00")
    assert Decimal(budget["spent"]) == Decimal("150.00")
    assert Decimal(budget["remaining"]) == Decimal("350.00")
    assert budget["percentage_used"] == 30.0


async def test_budget_check_empty_when_no_budgets(
    client: AsyncClient, db_session: AsyncSession, test_user: User
):
    """Budget check returns empty when no budgets exist."""
    response = await client.get("/api/v1/extension/budget-check")
    assert response.status_code == 200
    data = response.json()

    assert data["total_budgeted"] == "0"
    assert data["total_spent"] == "0"
    assert data["total_remaining"] == "0"
    assert data["budgets"] == []


async def test_cart_check_green_level(
    client: AsyncClient, db_session: AsyncSession, test_user: User
):
    """Cart check -- green level (plenty of remaining budget)."""
    category = await _create_category(db_session, test_user.id)
    await _create_account(db_session, test_user.id)
    await _create_budget(
        db_session, test_user.id, category.id, "Grocery Budget", Decimal("500.00")
    )
    # No spending -> 500 remaining, cart = 50 -> remaining > cart * 2

    response = await client.post(
        "/api/v1/extension/cart-check",
        json={
            "cart_total": "50.00",
            "merchant": "Whole Foods",
            "site": "amazon",
        },
    )
    assert response.status_code == 200
    data = response.json()

    assert data["can_afford"] is True
    assert data["warning_level"] == "green"
    assert data["cart_total"] == "50.00"


async def test_cart_check_yellow_level(
    client: AsyncClient, db_session: AsyncSession, test_user: User
):
    """Cart check -- yellow level (tight but affordable)."""
    category = await _create_category(db_session, test_user.id)
    account = await _create_account(db_session, test_user.id)
    await _create_budget(
        db_session, test_user.id, category.id, "Grocery Budget", Decimal("200.00")
    )
    # Spend 80 -> remaining = 120, cart = 100 -> remaining > cart but < cart*2
    await _create_transaction(
        db_session, test_user.id, account.id, category.id, 80.0
    )

    response = await client.post(
        "/api/v1/extension/cart-check",
        json={
            "cart_total": "100.00",
            "merchant": "Target",
            "site": "target",
        },
    )
    assert response.status_code == 200
    data = response.json()

    assert data["can_afford"] is True
    assert data["warning_level"] == "yellow"


async def test_cart_check_red_level(
    client: AsyncClient, db_session: AsyncSession, test_user: User
):
    """Cart check -- red level (over budget)."""
    category = await _create_category(db_session, test_user.id)
    account = await _create_account(db_session, test_user.id)
    await _create_budget(
        db_session, test_user.id, category.id, "Grocery Budget", Decimal("200.00")
    )
    # Spend 180 -> remaining = 20, cart = 50 -> remaining <= cart
    await _create_transaction(
        db_session, test_user.id, account.id, category.id, 180.0
    )

    response = await client.post(
        "/api/v1/extension/cart-check",
        json={
            "cart_total": "50.00",
            "merchant": "Walmart",
            "site": "walmart",
        },
    )
    assert response.status_code == 200
    data = response.json()

    assert data["can_afford"] is False
    assert data["warning_level"] == "red"


async def test_cart_check_affected_budgets(
    client: AsyncClient, db_session: AsyncSession, test_user: User
):
    """Cart check identifies affected budgets correctly."""
    cat1 = await _create_category(db_session, test_user.id, name="Groceries")
    cat2 = await _create_category(db_session, test_user.id, name="Entertainment")
    account = await _create_account(db_session, test_user.id)

    # Budget 1: 200 budgeted, 150 spent -> remaining 50
    await _create_budget(
        db_session, test_user.id, cat1.id, "Grocery Budget", Decimal("200.00")
    )
    await _create_transaction(
        db_session, test_user.id, account.id, cat1.id, 150.0
    )

    # Budget 2: 500 budgeted, 0 spent -> remaining 500
    await _create_budget(
        db_session, test_user.id, cat2.id, "Entertainment Budget", Decimal("500.00")
    )

    # Cart of 100: would push Grocery Budget over (150+100=250 > 200)
    # but not Entertainment (0+100=100 < 500)
    response = await client.post(
        "/api/v1/extension/cart-check",
        json={
            "cart_total": "100.00",
            "merchant": "Amazon",
            "site": "amazon",
        },
    )
    assert response.status_code == 200
    data = response.json()

    assert data["can_afford"] is True
    assert len(data["affected_budgets"]) == 1
    assert data["affected_budgets"][0]["name"] == "Grocery Budget"


async def test_budget_check_requires_auth(
    db_session: AsyncSession, test_user: User
):
    """Budget check endpoint requires authentication (401 without token)."""
    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    # Deliberately do NOT override get_current_user

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.get("/api/v1/extension/budget-check")
        assert response.status_code in (401, 403)

    app.dependency_overrides.clear()


async def test_cart_check_requires_auth(
    db_session: AsyncSession, test_user: User
):
    """Cart check endpoint requires authentication (401 without token)."""
    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    # Deliberately do NOT override get_current_user

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.post(
            "/api/v1/extension/cart-check",
            json={
                "cart_total": "50.00",
                "merchant": "Amazon",
                "site": "amazon",
            },
        )
        assert response.status_code in (401, 403)

    app.dependency_overrides.clear()


async def test_user_isolation(
    client: AsyncClient, db_session: AsyncSession, test_user: User
):
    """User isolation: budgets from another user should not appear."""
    # Create a budget for a different user
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

    other_category = await _create_category(
        db_session, other_user.id, name="Other Groceries"
    )
    await _create_budget(
        db_session,
        other_user.id,
        other_category.id,
        "Other Budget",
        Decimal("1000.00"),
    )

    # Authenticated as test_user -- should see no budgets
    response = await client.get("/api/v1/extension/budget-check")
    assert response.status_code == 200
    data = response.json()
    assert data["budgets"] == []
    assert data["total_budgeted"] == "0"
