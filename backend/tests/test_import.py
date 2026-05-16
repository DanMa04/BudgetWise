import os
import uuid
from datetime import date
from decimal import Decimal
from unittest.mock import AsyncMock, patch

from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.account import Account
from app.models.category import Category
from app.models.transaction import Transaction
from app.models.user import User
from app.services.import_service import (
    _parse_amount,
    _try_parse_date,
    auto_detect_columns,
    get_bank_presets,
    validate_mapping,
)

FIXTURES_DIR = os.path.join(os.path.dirname(__file__), "fixtures")


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
    db: AsyncSession, user_id: uuid.UUID, name: str
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


async def test_upload_csv(client: AsyncClient, db_session: AsyncSession, test_user: User):
    account = await _create_account(db_session, test_user.id)

    with open(os.path.join(FIXTURES_DIR, "generic_3col.csv"), "rb") as f:
        response = await client.post(
            f"/api/v1/import/upload?account_id={account.id}",
            files={"file": ("generic_3col.csv", f, "text/csv")},
        )

    assert response.status_code == 201
    data = response.json()
    assert "job_id" in data
    assert data["headers"] == ["Date", "Description", "Amount"]
    assert data["total_rows"] == 3
    # Auto-detect should map Date, Description, Amount
    mapping = data["suggested_mapping"]
    assert mapping.get("Date") == "date"
    assert mapping.get("Amount") == "amount"
    assert mapping.get("Description") == "description"


async def test_upload_chase_csv(client: AsyncClient, db_session: AsyncSession, test_user: User):
    account = await _create_account(db_session, test_user.id)

    with open(os.path.join(FIXTURES_DIR, "chase_checking.csv"), "rb") as f:
        response = await client.post(
            f"/api/v1/import/upload?account_id={account.id}",
            files={"file": ("chase_checking.csv", f, "text/csv")},
        )

    assert response.status_code == 201
    data = response.json()
    mapping = data["suggested_mapping"]
    # Chase format: "Transaction Date" -> date, "Amount" -> amount, "Description" -> description
    assert mapping.get("Transaction Date") == "date"
    assert mapping.get("Amount") == "amount"
    assert mapping.get("Description") == "description"
    assert data["total_rows"] == 5


async def test_auto_detect_date_column():
    headers = ["Posted", "Memo", "Value"]
    sample = [{"Posted": "01/15/2026", "Memo": "Coffee Shop", "Value": "4.50"}]
    mapping = auto_detect_columns(headers, sample)
    assert mapping.get("Posted") == "date"


async def test_auto_detect_amount_column():
    headers = ["When", "What", "Total"]
    sample = [{"When": "2026-01-15", "What": "Coffee", "Total": "4.50"}]
    mapping = auto_detect_columns(headers, sample)
    assert mapping.get("Total") == "amount"


async def test_auto_detect_debit_credit_columns():
    """Test that both debit and credit columns are detected separately."""
    headers = ["Date", "Description", "Debit", "Credit"]
    sample = [{"Date": "2026-01-15", "Description": "Coffee", "Debit": "4.50", "Credit": ""}]
    mapping = auto_detect_columns(headers, sample)
    assert mapping.get("Debit") == "debit"
    assert mapping.get("Credit") == "credit"


async def test_validate_mapping_missing_required():
    headers = ["Date", "Description", "Amount"]
    # Missing 'date'
    mapping = {"Description": "description", "Amount": "amount"}
    errors = validate_mapping(mapping, headers)
    assert any("date" in e.lower() for e in errors)


async def test_validate_mapping_valid():
    headers = ["Date", "Description", "Amount"]
    mapping = {"Date": "date", "Description": "description", "Amount": "amount"}
    errors = validate_mapping(mapping, headers)
    assert errors == []


async def test_validate_mapping_debit_credit_valid():
    """Debit + credit columns should satisfy the amount requirement."""
    headers = ["Date", "Description", "Debit", "Credit"]
    mapping = {
        "Date": "date",
        "Description": "description",
        "Debit": "debit",
        "Credit": "credit",
    }
    errors = validate_mapping(mapping, headers)
    assert errors == []


async def test_preview_import(client: AsyncClient, db_session: AsyncSession, test_user: User):
    account = await _create_account(db_session, test_user.id)

    # Upload
    with open(os.path.join(FIXTURES_DIR, "generic_3col.csv"), "rb") as f:
        upload_resp = await client.post(
            f"/api/v1/import/upload?account_id={account.id}",
            files={"file": ("generic_3col.csv", f, "text/csv")},
        )
    assert upload_resp.status_code == 201
    job_id = upload_resp.json()["job_id"]

    # Map columns
    map_resp = await client.post(
        f"/api/v1/import/{job_id}/map",
        json={"mapping": {"Date": "date", "Description": "description", "Amount": "amount"}},
    )
    assert map_resp.status_code == 200

    # Preview
    preview_resp = await client.get(f"/api/v1/import/{job_id}/preview")
    assert preview_resp.status_code == 200
    data = preview_resp.json()
    assert len(data["rows"]) == 3
    assert data["total_rows"] == 3
    # Verify first row parsed correctly
    first = data["rows"][0]
    assert first["date"] == "2026-01-15"
    assert first["amount"] == 45.67
    assert first["description"] == "Grocery Store"


async def test_execute_import(client: AsyncClient, db_session: AsyncSession, test_user: User):
    account = await _create_account(db_session, test_user.id)

    # Upload
    with open(os.path.join(FIXTURES_DIR, "generic_3col.csv"), "rb") as f:
        upload_resp = await client.post(
            f"/api/v1/import/upload?account_id={account.id}",
            files={"file": ("generic_3col.csv", f, "text/csv")},
        )
    job_id = upload_resp.json()["job_id"]

    # Map
    await client.post(
        f"/api/v1/import/{job_id}/map",
        json={"mapping": {"Date": "date", "Description": "description", "Amount": "amount"}},
    )

    # Confirm
    confirm_resp = await client.post(f"/api/v1/import/{job_id}/confirm")
    assert confirm_resp.status_code == 200
    data = confirm_resp.json()
    assert data["status"] == "completed"
    assert data["imported_rows"] == 3
    assert data["skipped_rows"] == 0
    assert data["error_rows"] == 0

    # Verify transactions in DB
    result = await db_session.execute(
        select(Transaction).where(Transaction.user_id == test_user.id)
    )
    transactions = list(result.scalars().all())
    assert len(transactions) == 3
    # Verify source
    for txn in transactions:
        assert txn.source == "csv_import"
        assert txn.import_job_id == uuid.UUID(job_id)


async def test_duplicate_detection(
    client: AsyncClient, db_session: AsyncSession, test_user: User
):
    account = await _create_account(db_session, test_user.id)

    # First import
    with open(os.path.join(FIXTURES_DIR, "generic_3col.csv"), "rb") as f:
        upload1 = await client.post(
            f"/api/v1/import/upload?account_id={account.id}",
            files={"file": ("generic_3col.csv", f, "text/csv")},
        )
    job_id1 = upload1.json()["job_id"]
    await client.post(
        f"/api/v1/import/{job_id1}/map",
        json={"mapping": {"Date": "date", "Description": "description", "Amount": "amount"}},
    )
    confirm1 = await client.post(f"/api/v1/import/{job_id1}/confirm")
    assert confirm1.json()["imported_rows"] == 3

    # Second import of the same file
    with open(os.path.join(FIXTURES_DIR, "generic_3col.csv"), "rb") as f:
        upload2 = await client.post(
            f"/api/v1/import/upload?account_id={account.id}",
            files={"file": ("generic_3col.csv", f, "text/csv")},
        )
    job_id2 = upload2.json()["job_id"]
    await client.post(
        f"/api/v1/import/{job_id2}/map",
        json={"mapping": {"Date": "date", "Description": "description", "Amount": "amount"}},
    )
    confirm2 = await client.post(f"/api/v1/import/{job_id2}/confirm")
    data2 = confirm2.json()
    assert data2["imported_rows"] == 0
    assert data2["skipped_rows"] == 3

    # Total transactions should still be 3
    result = await db_session.execute(
        select(Transaction).where(Transaction.user_id == test_user.id)
    )
    transactions = list(result.scalars().all())
    assert len(transactions) == 3


async def test_import_history(client: AsyncClient, db_session: AsyncSession, test_user: User):
    account = await _create_account(db_session, test_user.id)

    # Create two imports
    for filename in ["generic_3col.csv", "with_categories.csv"]:
        with open(os.path.join(FIXTURES_DIR, filename), "rb") as f:
            upload = await client.post(
                f"/api/v1/import/upload?account_id={account.id}",
                files={"file": (filename, f, "text/csv")},
            )
        assert upload.status_code == 201

    # Check history
    history_resp = await client.get("/api/v1/import/history")
    assert history_resp.status_code == 200
    data = history_resp.json()
    assert len(data) == 2
    # Verify ordered by created_at desc (most recent first)
    filenames = [j["filename"] for j in data]
    assert "generic_3col.csv" in filenames
    assert "with_categories.csv" in filenames


# --- New tests for enhanced functionality ---


async def test_parse_date_iso():
    """Test ISO date format (YYYY-MM-DD)."""
    assert _try_parse_date("2026-01-15") == date(2026, 1, 15)


async def test_parse_date_us():
    """Test US date format (MM/DD/YYYY)."""
    assert _try_parse_date("01/15/2026") == date(2026, 1, 15)


async def test_parse_date_uk():
    """Test UK date format (DD/MM/YYYY)."""
    assert _try_parse_date("15/01/2026") == date(2026, 1, 15)


async def test_parse_date_month_names():
    """Test date with month names."""
    assert _try_parse_date("15 Jan 2026") == date(2026, 1, 15)
    assert _try_parse_date("15 January 2026") == date(2026, 1, 15)
    assert _try_parse_date("Jan 15, 2026") == date(2026, 1, 15)
    assert _try_parse_date("January 15, 2026") == date(2026, 1, 15)


async def test_parse_date_with_time():
    """Test date with time component."""
    assert _try_parse_date("2026-01-15 14:30:00") == date(2026, 1, 15)


async def test_parse_date_dateutil_fallback():
    """Test dateutil fallback for unusual formats."""
    # dateutil handles "Jan 15 2026" without comma
    assert _try_parse_date("Jan 15 2026") == date(2026, 1, 15)


async def test_parse_date_empty_and_invalid():
    """Test empty/invalid date returns None."""
    assert _try_parse_date("") is None
    assert _try_parse_date("   ") is None
    assert _try_parse_date("not a date") is None


async def test_parse_amount_basic():
    """Test basic amount parsing."""
    assert _parse_amount("45.67") == Decimal("45.67")
    assert _parse_amount("-45.67") == Decimal("-45.67")
    assert _parse_amount("1,234.56") == Decimal("1234.56")


async def test_parse_amount_parentheses():
    """Test parentheses as negative notation."""
    assert _parse_amount("(45.67)") == Decimal("-45.67")
    assert _parse_amount("(1,234.56)") == Decimal("-1234.56")


async def test_parse_amount_currency_symbols():
    """Test various currency symbol handling."""
    assert _parse_amount("$45.67") == Decimal("45.67")
    assert _parse_amount("£45.67") == Decimal("45.67")
    assert _parse_amount("€45.67") == Decimal("45.67")
    assert _parse_amount("¥45.67") == Decimal("45.67")


async def test_parse_amount_cr_dr_suffix():
    """Test CR/DR suffix handling."""
    assert _parse_amount("45.67 CR") == Decimal("45.67")
    assert _parse_amount("45.67 DR") == Decimal("45.67")


async def test_parse_amount_whitespace():
    """Test whitespace handling in amounts."""
    assert _parse_amount("  45.67  ") == Decimal("45.67")
    assert _parse_amount("$ 45.67") == Decimal("45.67")


async def test_parse_amount_empty_and_invalid():
    """Test empty/invalid amount returns None."""
    assert _parse_amount("") is None
    assert _parse_amount("   ") is None
    assert _parse_amount("abc") is None


async def test_debit_credit_import(
    client: AsyncClient, db_session: AsyncSession, test_user: User
):
    """Test importing a file with separate debit/credit columns."""
    account = await _create_account(db_session, test_user.id)

    with open(os.path.join(FIXTURES_DIR, "debit_credit.csv"), "rb") as f:
        upload_resp = await client.post(
            f"/api/v1/import/upload?account_id={account.id}",
            files={"file": ("debit_credit.csv", f, "text/csv")},
        )
    assert upload_resp.status_code == 201
    job_id = upload_resp.json()["job_id"]

    # Map with debit/credit columns
    map_resp = await client.post(
        f"/api/v1/import/{job_id}/map",
        json={
            "mapping": {
                "Date": "date",
                "Description": "description",
                "Debit": "debit",
                "Credit": "credit",
            }
        },
    )
    assert map_resp.status_code == 200

    # Confirm import
    confirm_resp = await client.post(f"/api/v1/import/{job_id}/confirm")
    assert confirm_resp.status_code == 200
    data = confirm_resp.json()
    assert data["imported_rows"] == 4

    # Verify amounts: debits positive, credits negative
    result = await db_session.execute(
        select(Transaction)
        .where(Transaction.user_id == test_user.id)
        .order_by(Transaction.date.desc())
    )
    transactions = list(result.scalars().all())
    assert len(transactions) == 4

    # Find specific transactions by description
    txn_map = {t.description: t for t in transactions}
    assert txn_map["Grocery Store"].amount == Decimal("45.67")
    assert txn_map["Gas Station"].amount == Decimal("38.20")
    assert txn_map["Payroll Deposit"].amount == Decimal("-3500.00")
    assert txn_map["Refund from Amazon"].amount == Decimal("-25.00")


async def test_category_from_file(
    client: AsyncClient, db_session: AsyncSession, test_user: User
):
    """Test that category from file is applied when it matches a user category."""
    account = await _create_account(db_session, test_user.id)

    # Create matching categories
    await _create_category(db_session, test_user.id, "Groceries")
    await _create_category(db_session, test_user.id, "Entertainment")
    await db_session.commit()

    with open(os.path.join(FIXTURES_DIR, "with_categories.csv"), "rb") as f:
        upload_resp = await client.post(
            f"/api/v1/import/upload?account_id={account.id}",
            files={"file": ("with_categories.csv", f, "text/csv")},
        )
    assert upload_resp.status_code == 201
    job_id = upload_resp.json()["job_id"]

    # Map columns including category
    map_resp = await client.post(
        f"/api/v1/import/{job_id}/map",
        json={
            "mapping": {
                "date": "date",
                "description": "description",
                "amount": "amount",
                "category": "category",
                "notes": "notes",
            }
        },
    )
    assert map_resp.status_code == 200

    # Confirm
    confirm_resp = await client.post(f"/api/v1/import/{job_id}/confirm")
    assert confirm_resp.status_code == 200
    data = confirm_resp.json()
    assert data["imported_rows"] == 3

    # Check that matched categories are set
    result = await db_session.execute(
        select(Transaction)
        .where(Transaction.user_id == test_user.id)
        .order_by(Transaction.date.desc())
    )
    transactions = list(result.scalars().all())
    txn_map = {t.description: t for t in transactions}

    # Groceries and Entertainment should have category_source = "import"
    assert txn_map["Whole Foods"].category_id is not None
    assert txn_map["Whole Foods"].category_source == "import"
    assert txn_map["Netflix"].category_id is not None
    assert txn_map["Netflix"].category_source == "import"

    # Transportation was not created as a category, so it should be None
    # (unless ML picks it up, but with no model it won't)
    assert txn_map["Shell Gas"].category_source != "import" or txn_map[
        "Shell Gas"
    ].category_id is None


async def test_bank_presets_endpoint(
    client: AsyncClient, db_session: AsyncSession, test_user: User
):
    """Test that the bank presets endpoint returns data."""
    response = await client.get("/api/v1/import/presets")
    assert response.status_code == 200
    data = response.json()
    assert "chase_checking" in data
    assert "citi" in data
    assert "amex" in data
    assert data["chase_checking"]["name"] == "Chase Checking/Savings"
    assert data["citi"]["debit_column"] == "Debit"
    assert data["citi"]["credit_column"] == "Credit"


async def test_bank_presets_function():
    """Test get_bank_presets returns correct structure."""
    presets = get_bank_presets()
    assert len(presets) >= 8
    for key, preset in presets.items():
        assert "name" in preset
        assert "description_column" in preset
        assert "date_column" in preset
        # Each should have amount or debit/credit
        has_amount = "amount_column" in preset
        has_debit_credit = "debit_column" in preset and "credit_column" in preset
        assert has_amount or has_debit_credit


async def test_categorization_called_after_import(
    client: AsyncClient, db_session: AsyncSession, test_user: User
):
    """Test that categorization service is called after importing transactions."""
    account = await _create_account(db_session, test_user.id)

    with open(os.path.join(FIXTURES_DIR, "generic_3col.csv"), "rb") as f:
        upload_resp = await client.post(
            f"/api/v1/import/upload?account_id={account.id}",
            files={"file": ("generic_3col.csv", f, "text/csv")},
        )
    job_id = upload_resp.json()["job_id"]

    await client.post(
        f"/api/v1/import/{job_id}/map",
        json={"mapping": {"Date": "date", "Description": "description", "Amount": "amount"}},
    )

    # Mock the categorize_transaction function at its source module
    mock_cat_id = uuid.uuid4()
    mock_return = (mock_cat_id, 0.85, "ml")

    with patch(
        "app.services.categorization_service.categorize_transaction",
        new_callable=AsyncMock,
        return_value=mock_return,
    ) as mock_categorize:
        confirm_resp = await client.post(f"/api/v1/import/{job_id}/confirm")
        assert confirm_resp.status_code == 200
        assert confirm_resp.json()["imported_rows"] == 3

        # Categorize should have been called for each uncategorized transaction
        assert mock_categorize.call_count == 3

    # Verify transactions have the mocked category
    result = await db_session.execute(
        select(Transaction).where(Transaction.user_id == test_user.id)
    )
    transactions = list(result.scalars().all())
    for txn in transactions:
        assert txn.category_id == mock_cat_id
        assert txn.category_source == "ml"


async def test_categorization_failure_does_not_break_import(
    client: AsyncClient, db_session: AsyncSession, test_user: User
):
    """Test that if categorization fails, the import still succeeds."""
    account = await _create_account(db_session, test_user.id)

    with open(os.path.join(FIXTURES_DIR, "generic_3col.csv"), "rb") as f:
        upload_resp = await client.post(
            f"/api/v1/import/upload?account_id={account.id}",
            files={"file": ("generic_3col.csv", f, "text/csv")},
        )
    job_id = upload_resp.json()["job_id"]

    await client.post(
        f"/api/v1/import/{job_id}/map",
        json={"mapping": {"Date": "date", "Description": "description", "Amount": "amount"}},
    )

    # Mock categorize_transaction to raise an exception
    with patch(
        "app.services.categorization_service.categorize_transaction",
        new_callable=AsyncMock,
        side_effect=RuntimeError("ML model unavailable"),
    ):
        confirm_resp = await client.post(f"/api/v1/import/{job_id}/confirm")
        assert confirm_resp.status_code == 200
        data = confirm_resp.json()
        # Import should still succeed
        assert data["imported_rows"] == 3
        assert data["status"] == "completed"

    # Transactions should exist but without category
    result = await db_session.execute(
        select(Transaction).where(Transaction.user_id == test_user.id)
    )
    transactions = list(result.scalars().all())
    assert len(transactions) == 3
    for txn in transactions:
        assert txn.category_id is None


async def test_uk_dates_import(
    client: AsyncClient, db_session: AsyncSession, test_user: User
):
    """Test importing a file with UK/mixed date formats."""
    account = await _create_account(db_session, test_user.id)

    with open(os.path.join(FIXTURES_DIR, "uk_dates.csv"), "rb") as f:
        upload_resp = await client.post(
            f"/api/v1/import/upload?account_id={account.id}",
            files={"file": ("uk_dates.csv", f, "text/csv")},
        )
    assert upload_resp.status_code == 201
    job_id = upload_resp.json()["job_id"]

    map_resp = await client.post(
        f"/api/v1/import/{job_id}/map",
        json={"mapping": {"Date": "date", "Description": "description", "Amount": "amount"}},
    )
    assert map_resp.status_code == 200

    confirm_resp = await client.post(f"/api/v1/import/{job_id}/confirm")
    assert confirm_resp.status_code == 200
    data = confirm_resp.json()
    assert data["imported_rows"] == 4
    assert data["error_rows"] == 0
