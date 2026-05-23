from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.ai_categorization import (
    AnalyzeRequest,
    AnalyzeResponse,
    ApplyRequest,
    ApplyResponse,
)
from app.services.ai_categorization_service import analyze_categories, apply_proposal
from app.services.snapshot_service import create_snapshot

router = APIRouter(prefix="/ai/categorize", tags=["ai-categorization"])


@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze(
    data: AnalyzeRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if data.mode not in ("subcategorize", "merge"):
        raise HTTPException(status_code=400, detail="Mode must be 'subcategorize' or 'merge'")
    try:
        result = await analyze_categories(db, current_user.id, data.mode)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return result


@router.post("/apply", response_model=ApplyResponse)
async def apply(
    data: ApplyRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await create_snapshot(db, current_user.id, "Auto-save before AI reorganize", "pre_ai")
    try:
        result = await apply_proposal(
            db,
            current_user.id,
            {
                "proposed_categories": data.proposed_categories,
                "assignments": data.assignments,
            },
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    return result
