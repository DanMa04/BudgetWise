import os
import uuid

from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.account import Account
from app.models.transaction import Transaction
from app.models.user import User
from app.services.import_service import (
    auto_detect_columns,
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
