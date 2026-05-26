from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.dependencies import get_current_user
from app.middleware.rate_limit import limiter
from app.models.user import User
from app.schemas.user import UserRead, UserUpdate
from app.services.gdpr_service import delete_user_account, export_user_data

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/me", response_model=UserRead)
@limiter.limit("10/minute")
async def get_me(request: Request, current_user: User = Depends(get_current_user)):
    return current_user


@router.patch("/me", response_model=UserRead)
@limiter.limit("10/minute")
async def update_me(
    request: Request,
    data: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(current_user, key, value)
    await db.flush()
    await db.refresh(current_user)
    return current_user


@router.get("/me/export")
@limiter.limit("3/hour")
async def export_my_data(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    data = await export_user_data(db, current_user)
    return JSONResponse(
        content=data,
        headers={"Content-Disposition": 'attachment; filename="kallio-data-export.json"'},
    )


@router.delete("/me", status_code=204)
@limiter.limit("3/hour")
async def delete_my_account(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await delete_user_account(db, current_user, settings.clerk_secret_key)
