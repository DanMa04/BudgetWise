from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.middleware.rate_limit import limiter
from app.models.user import User
from app.schemas.ai_assistant import (
    ApplyAiProposalRequest,
    ApplyAiProposalResponse,
    ChatRequest,
    ChatResponse,
)
from app.schemas.onboarding import OnboardingPatch
from app.services import ai_assistant_service, onboarding_service

router = APIRouter(prefix="/ai/assistant", tags=["ai-assistant"])


@router.post("/chat", response_model=ChatResponse)
@limiter.limit("20/minute")
async def chat(
    request: Request,
    data: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await ai_assistant_service.chat_turn(db, current_user.id, data)


@router.post("/apply", response_model=ApplyAiProposalResponse)
@limiter.limit("3/minute")
async def apply(
    request: Request,
    data: ApplyAiProposalRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await ai_assistant_service.apply_proposal(
        db, current_user.id, data.proposal
    )
    # Mark onboarding steps as done in the same transaction.
    await onboarding_service.patch_state(
        db,
        current_user,
        OnboardingPatch(
            path="ai",
            ai_assist_used=True,
            steps={
                "transactions_categorized": {"done": True},
                "goals_created": {"done": True},
                "budget_created": {"done": True},
            },
        ),
    )
    return result
