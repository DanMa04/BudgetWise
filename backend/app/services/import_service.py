import io
import re
import uuid
from datetime import UTC, date, datetime
from decimal import Decimal, InvalidOperation

import pandas as pd
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.import_job import ImportJob
from app.models.transaction import Transaction
from app.schemas.import_job import ImportPreviewResponse, ImportPreviewRow

# In-memory cache for parsed file data keyed by job_id.
# Phase 10 improvement: move to Redis or S3.
_file_cache: dict[uuid.UUID, tuple[list[str], list[dict], int]] = {}

DATE_FORMATS = ["%Y-%m-%d", "%m/%d/%Y", "%m/%d/%y", "%m-%d-%Y"]


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
    date, amount, description, category, notes, skip.
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

    if "amount" not in mapping.values() and debit_col:
        mapping[debit_col] = "amount"
    if "amount" not in mapping.values() and credit_col:
        mapping[credit_col] = "amount"

    # If still no amount column, try to find numeric columns
    if "amount" not in mapping.values() and sample_rows:
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
    required_fields = {"date", "amount", "description"}
    mapped_fields = set(mapping.values())

    for field in required_fields:
        if field not in mapped_fields:
            errors.append(f"Required field '{field}' is not mapped")

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

        # Parse amount
        raw_amount = str(row.get(field_to_col.get("amount", ""), ""))
        parsed_amount = _parse_amount(raw_amount)
        if parsed_amount is None:
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

            # Parse amount
            raw_amount = str(row.get(field_to_col.get("amount", ""), ""))
            parsed_amount = _parse_amount(raw_amount)
            if parsed_amount is None:
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

            transaction = Transaction(
                user_id=user_id,
                account_id=account_id,
                date=parsed_date,
                amount=parsed_amount,
                description=description,
                notes=notes,
                source=source,
                import_job_id=job_id,
            )
            db.add(transaction)
            imported += 1
        except Exception as exc:
            errors.append({"row": row_num, "error": str(exc)})
            error_count += 1

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
    """Try multiple date formats to parse a date string."""
    value = value.strip()
    if not value:
        return None
    for fmt in DATE_FORMATS:
        try:
            return datetime.strptime(value, fmt).date()
        except ValueError:
            continue
    return None


def _parse_amount(value: str) -> Decimal | None:
    """Parse an amount string, handling currency symbols, commas, parentheses (negatives)."""
    value = value.strip()
    if not value:
        return None

    # Handle parentheses as negative: (45.67) -> -45.67
    is_negative = False
    if value.startswith("(") and value.endswith(")"):
        value = value[1:-1]
        is_negative = True

    # Remove currency symbols and commas
    value = re.sub(r"[$£€,]", "", value)
    value = value.strip()

    if not value:
        return None

    try:
        amount = Decimal(value)
        if is_negative:
            amount = -amount
        return amount
    except InvalidOperation:
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
