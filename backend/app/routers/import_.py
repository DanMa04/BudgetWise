import uuid

from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.import_job import ImportJob
from app.models.user import User
from app.schemas.import_job import (
    AutoDetectResponse,
    ColumnMappingRequest,
    ImportJobRead,
    ImportPreviewResponse,
)
from app.services.import_service import (
    auto_detect_columns,
    clear_file_data,
    execute_import,
    get_bank_presets,
    get_file_data,
    parse_file,
    preview_import,
    store_file_data,
    validate_mapping,
)

router = APIRouter(prefix="/import", tags=["import"])

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB
ALLOWED_EXTENSIONS = {"csv", "xlsx", "xls"}


@router.get("/presets")
async def list_presets():
    """Return known bank format presets for column mapping."""
    return get_bank_presets()


@router.post("/upload", response_model=AutoDetectResponse, status_code=status.HTTP_201_CREATED)
async def upload_file(
    file: UploadFile,
    account_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Upload a CSV/XLSX file. Creates an ImportJob and returns auto-detected column mapping."""
    # Validate file extension
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")

    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '.{ext}'. Accepted: .csv, .xlsx, .xls",
        )

    # Read file content
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File size exceeds 10 MB limit")

    # Parse the file
    try:
        headers, rows, total = await parse_file(content, file.filename)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Could not parse file: {exc}")

    if not rows:
        raise HTTPException(status_code=400, detail="File contains no data rows")

    # Auto-detect column mapping
    sample = rows[:5]
    suggested_mapping = auto_detect_columns(headers, sample)

    # Determine file_type
    file_type = "xlsx" if ext in ("xlsx", "xls") else "csv"

    # Create ImportJob
    job = ImportJob(
        user_id=current_user.id,
        account_id=account_id,
        filename=file.filename,
        file_type=file_type,
        status="mapping",
        total_rows=total,
    )
    db.add(job)
    await db.flush()
    await db.refresh(job)

    # Store parsed data in memory cache
    store_file_data(job.id, headers, rows, total)

    # Build sample rows for response (convert all values to strings)
    sample_rows_out = [
        {k: str(v) for k, v in row.items()} for row in sample
    ]

    return AutoDetectResponse(
        job_id=job.id,
        headers=headers,
        suggested_mapping=suggested_mapping,
        sample_rows=sample_rows_out,
        total_rows=total,
    )


@router.post("/{job_id}/map")
async def map_columns(
    job_id: uuid.UUID,
    body: ColumnMappingRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Validate and save the column mapping for an import job."""
    job = await _get_user_job(db, current_user.id, job_id)

    cached = get_file_data(job_id)
    if not cached:
        raise HTTPException(status_code=400, detail="File data expired. Please re-upload.")
    headers, _rows, _total = cached

    errors = validate_mapping(body.mapping, headers)
    if errors:
        raise HTTPException(status_code=422, detail={"validation_errors": errors})

    job.column_mapping = body.mapping
    job.status = "previewing"
    await db.flush()
    await db.refresh(job)

    return {"status": "ok", "job_id": str(job.id)}


@router.get("/{job_id}/preview", response_model=ImportPreviewResponse)
async def preview(
    job_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Preview the first 20 rows after applying the column mapping."""
    job = await _get_user_job(db, current_user.id, job_id)

    if not job.column_mapping:
        raise HTTPException(status_code=400, detail="Column mapping not set. Call /map first.")

    cached = get_file_data(job_id)
    if not cached:
        raise HTTPException(status_code=400, detail="File data expired. Please re-upload.")
    _headers, rows, _total = cached

    result = await preview_import(db, current_user.id, job_id, job.column_mapping, rows)
    return result


@router.post("/{job_id}/confirm", response_model=ImportJobRead)
async def confirm_import(
    job_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Execute the import, creating transactions from the file data."""
    job = await _get_user_job(db, current_user.id, job_id)

    if not job.column_mapping:
        raise HTTPException(status_code=400, detail="Column mapping not set. Call /map first.")

    if job.status == "completed":
        raise HTTPException(status_code=400, detail="Import already completed.")

    cached = get_file_data(job_id)
    if not cached:
        raise HTTPException(status_code=400, detail="File data expired. Please re-upload.")
    _headers, rows, _total = cached

    updated_job = await execute_import(
        db,
        current_user.id,
        job_id,
        job.account_id,
        job.column_mapping,
        rows,
        job.file_type,
    )

    # Clean up cached data
    clear_file_data(job_id)

    return updated_job


@router.get("/history", response_model=list[ImportJobRead])
async def import_history(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List past import jobs for the current user, ordered by created_at desc."""
    result = await db.execute(
        select(ImportJob)
        .where(ImportJob.user_id == current_user.id)
        .order_by(ImportJob.created_at.desc())
    )
    jobs = list(result.scalars().all())
    return jobs


async def _get_user_job(
    db: AsyncSession, user_id: uuid.UUID, job_id: uuid.UUID
) -> ImportJob:
    """Fetch an ImportJob belonging to the given user, or 404."""
    result = await db.execute(
        select(ImportJob).where(ImportJob.id == job_id, ImportJob.user_id == user_id)
    )
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Import job not found")
    return job
