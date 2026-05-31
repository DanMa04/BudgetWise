from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.middleware.rate_limit import limiter
from app.models.user import User
from app.schemas.onboarding import OnboardingPatch, OnboardingState
from app.services import onboarding_service

router = APIRouter(prefix="/onboarding", tags=["onboarding"])


@router.get("/state", response_model=OnboardingState)
@limiter.limit("60/minute")
async def get_onboarding_state(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await onboarding_service.get_state(db, current_user)


@router.patch("/state", response_model=OnboardingState)
@limiter.limit("60/minute")
async def patch_onboarding_state(
    request: Request,
    patch: OnboardingPatch,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await onboarding_service.patch_state(db, current_user, patch)


@router.post("/dismiss", response_model=OnboardingState)
@limiter.limit("10/minute")
async def dismiss_onboarding(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await onboarding_service.dismiss(db, current_user)


@router.post("/reset", response_model=OnboardingState)
@limiter.limit("10/minute")
async def reset_onboarding(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await onboarding_service.reset(db, current_user)
