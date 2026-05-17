import io
import logging
import re
import uuid
from datetime import UTC, date, datetime
from decimal import Decimal, InvalidOperation

import pandas as pd
from dateutil import parser as dateutil_parser
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.category import Category
from app.models.import_job import ImportJob
from app.models.transaction import Transaction
from app.schemas.import_job import ImportPreviewResponse, ImportPreviewRow

logger = logging.getLogger(__name__)

# In-memory cache for parsed file data keyed by job_id.
# Phase 10 improvement: move to Redis or S3.
_file_cache: dict[uuid.UUID, tuple[list[str], list[dict], int]] = {}

DATE_FORMATS = [
    "%Y-%m-%d",
    "%m/%d/%Y",
    "%m/%d/%y",
    "%d/%m/%Y",
    "%d/%m/%y",
    "%m-%d-%Y",
    "%Y-%m-%d %H:%M:%S",
    "%d %b %Y",
    "%d %B %Y",
    "%b %d, %Y",
    "%B %d, %Y",
]

BANK_PRESETS = {
    "chase_checking": {
        "name": "Chase Checking/Savings",
        "date_column": "Transaction Date",
        "amount_column": "Amount",
        "description_column": "Description",
        "category_column": "Category",
    },
    "chase_credit": {
        "name": "Chase Credit Card",
        "date_column": "Transaction Date",
        "amount_column": "Amount",
        "description_column": "Description",
        "category_column": "Category",
    },
    "bofa": {
        "name": "Bank of America",
        "date_column": "Date",
        "amount_column": "Amount",
        "description_column": "Description",
    },
    "citi": {
        "name": "Citibank",
        "date_column": "Date",
        "debit_column": "Debit",
        "credit_column": "Credit",
        "description_column": "Description",
    },
    "amex": {
        "name": "American Express",
        "date_column": "Date",
        "amount_column": "Amount",
        "description_column": "Description",
        "notes_column": "Extended Details",
    },
    "wells_fargo": {
        "name": "Wells Fargo",
        "date_column": "Date",
        "amount_column": "Amount",
        "description_column": "Description",
    },
    "capital_one": {
        "name": "Capital One",
        "date_column": "Transaction Date",
        "debit_column": "Debit",
        "credit_column": "Credit",
        "description_column": "Description",
        "category_column": "Category",
    },
    "discover": {
        "name": "Discover",
        "date_column": "Trans. Date",
        "amount_column": "Amount",
        "description_column": "Description",
        "category_column": "Category",
    },
}


def get_bank_presets() -> dict[str, dict[str, str]]:
    """Return known column mappings for common banks."""
    return BANK_PRESETS


async def parse_file(
    file_content: bytes, filename: str
) -> tuple[list[str], list[dict], int]:
    """Parse a CSV or XLSX file and return (headers, rows_as_dicts, total_row_count)."""
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""

    if ext in ("xlsx", "xls"):
        df = pd.read_excel(io.BytesIO(file_content), sheet_name=0, dtype=str)
    elif ext == "csv":
        # Try utf-8 first, then latin-1
        try:
            df = pd.read_csv(io.BytesIO(file_content), dtype=str, encoding="utf-8")
        except UnicodeDecodeError:
            df = pd.read_csv(io.BytesIO(file_content), dtype=str, encoding="latin-1")
    else:
        raise ValueError(f"Unsupported file type: .{ext}")

    df = df.fillna("")
    headers = list(df.columns)
    rows = df.to_dict(orient="records")
    return headers, rows, len(rows)


def auto_detect_columns(
    headers: list[str], sample_rows: list[dict]
) -> dict[str, str]:
    """Heuristic mapping of file columns to our fields.

    Returns dict mapping file column names to our field names:
    date, amount, debit, credit, description, category, notes, skip.
    """
    mapping: dict[str, str] = {}
    headers_lower = {h: h.lower().strip() for h in headers}

    # Date detection
    date_keywords = ["transaction date", "trans date", "date", "time", "posted"]
    for h, h_low in headers_lower.items():
        if h not in mapping and any(kw in h_low for kw in date_keywords):
            mapping[h] = "date"
            break
    if "date" not in mapping.values() and sample_rows:
        # Try parsing sample values
        for h in headers:
            if h in mapping:
                continue
            val = str(sample_rows[0].get(h, ""))
            if _try_parse_date(val) is not None:
                mapping[h] = "date"
                break

    # Amount detection -- handle debit/credit columns (e.g. Citi)
    debit_col = None
    credit_col = None
    amount_keywords = ["amount", "sum", "total", "value"]
    for h, h_low in headers_lower.items():
        if h in mapping:
            continue
        if h_low == "debit":
            debit_col = h
        elif h_low == "credit":
            credit_col = h
        elif any(kw in h_low for kw in amount_keywords):
            mapping[h] = "amount"
            break

    # If both debit and credit columns found, map them separately
    if "amount" not in mapping.values() and debit_col and credit_col:
        mapping[debit_col] = "debit"
        mapping[credit_col] = "credit"
    elif "amount" not in mapping.values() and debit_col:
        mapping[debit_col] = "amount"
    elif "amount" not in mapping.values() and credit_col:
        mapping[credit_col] = "amount"

    # If still no amount column, try to find numeric columns
    if (
        "amount" not in mapping.values()
        and "debit" not in mapping.values()
        and sample_rows
    ):
        for h in headers:
            if h in mapping:
                continue
            val = str(sample_rows[0].get(h, ""))
            cleaned = re.sub(r"[$,\s]", "", val)
            try:
                float(cleaned)
                mapping[h] = "amount"
                break
            except ValueError:
                continue

    # Description detection
    desc_keywords = ["description", "memo", "narrative", "payee", "merchant", "name"]
    for h, h_low in headers_lower.items():
        if h in mapping:
            continue
        if any(kw in h_low for kw in desc_keywords):
            mapping[h] = "description"
            break

    # Fallback: pick the column with the longest average string values
    if "description" not in mapping.values() and sample_rows:
        best_col = None
        best_avg = 0
        for h in headers:
            if h in mapping:
                continue
            avg_len = sum(len(str(row.get(h, ""))) for row in sample_rows) / len(
                sample_rows
            )
            if avg_len > best_avg:
                best_avg = avg_len
                best_col = h
        if best_col:
            mapping[best_col] = "description"

    # Category detection
    cat_keywords = ["category", "type", "class"]
    for h, h_low in headers_lower.items():
        if h in mapping:
            continue
        if any(kw in h_low for kw in cat_keywords):
            mapping[h] = "category"
            break

    # Notes detection
    notes_keywords = ["notes", "memo", "comment", "remark"]
    for h, h_low in headers_lower.items():
        if h in mapping:
            continue
        if any(kw in h_low for kw in notes_keywords):
            mapping[h] = "notes"
            break

    return mapping


def validate_mapping(mapping: dict[str, str], headers: list[str]) -> list[str]:
    """Validate that required fields are mapped and mapped columns exist.

    Returns list of validation errors (empty = valid).
    """
    errors: list[str] = []
    mapped_fields = set(mapping.values())

    # amount OR (debit + credit) required
    has_amount = "amount" in mapped_fields
    has_debit_credit = "debit" in mapped_fields and "credit" in mapped_fields
    has_debit_only = "debit" in mapped_fields and "credit" not in mapped_fields

    if not has_amount and not has_debit_credit and not has_debit_only:
        errors.append("Required field 'amount' is not mapped")

    if "date" not in mapped_fields:
        errors.append("Required field 'date' is not mapped")
    if "description" not in mapped_fields:
        errors.append("Required field 'description' is not mapped")

    for col_name in mapping:
        if col_name not in headers:
            errors.append(f"Column '{col_name}' does not exist in file headers")

    return errors


async def preview_import(
    db: AsyncSession,
    user_id: uuid.UUID,
    job_id: uuid.UUID,
    mapping: dict[str, str],
    rows: list[dict],
) -> ImportPreviewResponse:
    """Preview the first 20 rows after applying the column mapping."""
    preview_rows: list[ImportPreviewRow] = []
    global_warnings: list[str] = []
    # Invert mapping: our_field -> file_column
    field_to_col = {v: k for k, v in mapping.items()}

    for row in rows[:20]:
        warnings: list[str] = []

        # Parse date
        raw_date = str(row.get(field_to_col.get("date", ""), ""))
        parsed_date = _try_parse_date(raw_date)
        if parsed_date is None:
            warnings.append(f"Could not parse date: '{raw_date}'")
            date_str = raw_date
        else:
            date_str = parsed_date.isoformat()

        # Parse amount (handle debit/credit columns)
        parsed_amount = _resolve_amount(row, field_to_col)
        if parsed_amount is None:
            raw_amount = str(row.get(field_to_col.get("amount", ""), ""))
            warnings.append(f"Could not parse amount: '{raw_amount}'")
            amount_val = 0.0
        else:
            amount_val = float(parsed_amount)

        # Description
        description = str(row.get(field_to_col.get("description", ""), "")).strip()

        # Optional: category
        category = None
        if "category" in field_to_col:
            category = str(row.get(field_to_col["category"], "")).strip() or None

        # Optional: notes
        notes = None
        if "notes" in field_to_col:
            notes = str(row.get(field_to_col["notes"], "")).strip() or None

        # Duplicate detection
        is_duplicate = False
        if parsed_date is not None and parsed_amount is not None and description:
            is_duplicate = await detect_duplicates(
                db, user_id, parsed_date, parsed_amount, description
            )
            if is_duplicate:
                warnings.append("Possible duplicate transaction")

        preview_rows.append(
            ImportPreviewRow(
                date=date_str,
                amount=amount_val,
                description=description,
                category=category,
                notes=notes,
                warnings=warnings,
                is_duplicate=is_duplicate,
            )
        )

    return ImportPreviewResponse(
        rows=preview_rows,
        total_rows=len(rows),
        warnings=global_warnings,
    )


async def execute_import(
    db: AsyncSession,
    user_id: uuid.UUID,
    job_id: uuid.UUID,
    account_id: uuid.UUID,
    mapping: dict[str, str],
    rows: list[dict],
    file_type: str = "csv",
) -> ImportJob:
    """Execute the import, creating transactions for each valid row."""
    field_to_col = {v: k for k, v in mapping.items()}
    source = "csv_import" if file_type == "csv" else "excel_import"

    imported = 0
    skipped = 0
    error_count = 0
    errors: list[dict] = []
    created_transactions: list[Transaction] = []

    # Pre-fetch user categories for file-category matching
    category_map = await _build_category_map(db, user_id)

    for i, row in enumerate(rows):
        row_num = i + 1
        try:
            # Parse date
            raw_date = str(row.get(field_to_col.get("date", ""), ""))
            parsed_date = _try_parse_date(raw_date)
            if parsed_date is None:
                errors.append({"row": row_num, "error": f"Invalid date: '{raw_date}'"})
                error_count += 1
                continue

            # Parse amount (handle debit/credit columns)
            parsed_amount = _resolve_amount(row, field_to_col)
            if parsed_amount is None:
                raw_amount = str(row.get(field_to_col.get("amount", ""), ""))
                errors.append(
                    {"row": row_num, "error": f"Invalid amount: '{raw_amount}'"}
                )
                error_count += 1
                continue

            # Description
            description = str(
                row.get(field_to_col.get("description", ""), "")
            ).strip()
            if not description:
                errors.append({"row": row_num, "error": "Empty description"})
                error_count += 1
                continue

            # Duplicate check
            is_dup = await detect_duplicates(
                db, user_id, parsed_date, parsed_amount, description
            )
            if is_dup:
                skipped += 1
                continue

            # Optional notes
            notes = None
            if "notes" in field_to_col:
                notes = str(row.get(field_to_col["notes"], "")).strip() or None

            # Check file category column
            category_id = None
            category_source = None
            if "category" in field_to_col:
                raw_category = str(row.get(field_to_col["category"], "")).strip()
                if raw_category and raw_category.lower() in category_map:
                    category_id = category_map[raw_category.lower()]
                    category_source = "import"

            transaction = Transaction(
                user_id=user_id,
                account_id=account_id,
                date=parsed_date,
                amount=parsed_amount,
                description=description,
                notes=notes,
                source=source,
                import_job_id=job_id,
                category_id=category_id,
                category_source=category_source,
                category_confidence=1.0 if category_id else None,
            )
            db.add(transaction)
            created_transactions.append(transaction)
            imported += 1
        except Exception as exc:
            errors.append({"row": row_num, "error": str(exc)})
            error_count += 1

    # Flush to persist transactions before categorization
    await db.flush()

    # Auto-categorize uncategorized transactions via ML/rules
    await _categorize_imported_transactions(db, user_id, created_transactions)

    # Update import job
    result = await db.execute(
        select(ImportJob).where(ImportJob.id == job_id)
    )
    job = result.scalar_one()
    job.imported_rows = imported
    job.skipped_rows = skipped
    job.error_rows = error_count
    job.errors = errors if errors else None
    job.status = "completed"
    job.completed_at = datetime.now(UTC)

    await db.flush()
    await db.refresh(job)
    return job


async def _build_category_map(
    db: AsyncSession, user_id: uuid.UUID
) -> dict[str, uuid.UUID]:
    """Build a case-insensitive mapping of category names to IDs for a user."""
    result = await db.execute(
        select(Category).where(
            (Category.user_id == user_id) | (Category.is_system.is_(True))
        )
    )
    categories = result.scalars().all()
    return {cat.name.lower(): cat.id for cat in categories}


async def _categorize_imported_transactions(
    db: AsyncSession, user_id: uuid.UUID, transactions: list[Transaction]
) -> None:
    """Auto-categorize imported transactions that don't already have a category.

    Uses the categorization service (rules + ML). Failures are logged but do not
    prevent the import from succeeding.
    """
    uncategorized = [t for t in transactions if t.category_id is None]
    if not uncategorized:
        return

    try:
        from app.models.categorization_rule import CategorizationRule
        from app.services.categorization_service import (
            categorize_transaction,
            seed_default_rules,
        )

        rule_check = await db.execute(
            select(CategorizationRule.id)
            .where(CategorizationRule.user_id == user_id)
            .limit(1)
        )
        if not rule_check.scalar_one_or_none():
            await seed_default_rules(db, user_id)

        for txn in uncategorized:
            try:
                cat_id, confidence, source = await categorize_transaction(
                    db, user_id, txn.description
                )
                if cat_id:
                    txn.category_id = cat_id
                    txn.category_confidence = confidence
                    txn.category_source = source
            except Exception as exc:
                logger.debug(
                    "Categorization failed for txn '%s': %s", txn.description, exc
                )
                continue

        await db.flush()
    except Exception as exc:
        logger.warning("Categorization service unavailable during import: %s", exc)


def _resolve_amount(row: dict, field_to_col: dict[str, str]) -> Decimal | None:
    """Resolve the amount from a row, handling debit/credit columns.

    If both debit and credit columns are mapped:
    - Debit values become positive (expenses)
    - Credit values become negative (income/refunds)
    - Use whichever is non-zero/non-empty

    If only amount column, use as-is.
    """
    if "debit" in field_to_col and "credit" in field_to_col:
        raw_debit = str(row.get(field_to_col["debit"], "")).strip()
        raw_credit = str(row.get(field_to_col["credit"], "")).strip()

        debit_val = _parse_amount(raw_debit) if raw_debit else None
        credit_val = _parse_amount(raw_credit) if raw_credit else None

        if debit_val is not None and debit_val != Decimal("0"):
            # Debit = negative (money out)
            return -abs(debit_val)
        elif credit_val is not None and credit_val != Decimal("0"):
            # Credit = positive (money in)
            return abs(credit_val)
        elif debit_val is not None:
            return Decimal("0")
        elif credit_val is not None:
            return Decimal("0")
        return None
    elif "amount" in field_to_col:
        raw_amount = str(row.get(field_to_col["amount"], ""))
        return _parse_amount(raw_amount)
    elif "debit" in field_to_col:
        # Only debit column, treat like amount
        raw_debit = str(row.get(field_to_col["debit"], ""))
        return _parse_amount(raw_debit)
    return None


async def detect_duplicates(
    db: AsyncSession,
    user_id: uuid.UUID,
    txn_date: date,
    amount: Decimal,
    description: str,
) -> bool:
    """Check if a transaction with same date, amount, and description exists for this user."""
    result = await db.execute(
        select(Transaction.id).where(
            and_(
                Transaction.user_id == user_id,
                Transaction.date == txn_date,
                Transaction.amount == amount,
                Transaction.description == description,
            )
        ).limit(1)
    )
    return result.scalar_one_or_none() is not None


def _try_parse_date(value: str) -> date | None:
    """Try multiple date formats to parse a date string, with dateutil fallback."""
    stripped = value.strip()
    if not stripped:
        return None
    # Try explicit formats first (faster)
    for fmt in DATE_FORMATS:
        try:
            return datetime.strptime(stripped, fmt).date()
        except ValueError:
            continue
    # Fallback to dateutil (handles most formats)
    try:
        return dateutil_parser.parse(stripped, dayfirst=False).date()
    except (ValueError, TypeError):
        return None


def _parse_amount(value: str) -> Decimal | None:
    """Parse an amount string, handling currency symbols, commas, parentheses, CR/DR."""
    stripped = value.strip()
    if not stripped:
        return None

    # Handle parentheses as negative
    is_negative = False
    if stripped.startswith("(") and stripped.endswith(")"):
        is_negative = True
        stripped = stripped[1:-1]

    # Handle CR/DR suffixes
    upper = stripped.upper()
    if upper.endswith(" CR") or upper.endswith(" DR"):
        stripped = stripped[:-3].strip()

    # Remove currency symbols and whitespace
    cleaned = re.sub(r"[^\d.,\-]", "", stripped)
    if not cleaned:
        return None

    # Handle thousands separators
    cleaned = cleaned.replace(",", "")

    # Handle negative sign
    if cleaned.startswith("-"):
        is_negative = not is_negative
        cleaned = cleaned[1:]

    if not cleaned:
        return None

    try:
        result = Decimal(cleaned)
        return -result if is_negative else result
    except (InvalidOperation, ValueError):
        return None


def store_file_data(
    job_id: uuid.UUID, headers: list[str], rows: list[dict], total: int
) -> None:
    """Store parsed file data in the in-memory cache."""
    _file_cache[job_id] = (headers, rows, total)


def get_file_data(
    job_id: uuid.UUID,
) -> tuple[list[str], list[dict], int] | None:
    """Retrieve parsed file data from the in-memory cache."""
    return _file_cache.get(job_id)


def clear_file_data(job_id: uuid.UUID) -> None:
    """Remove parsed file data from the cache."""
    _file_cache.pop(job_id, None)
