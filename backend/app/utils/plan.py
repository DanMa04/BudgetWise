from fastapi import Depends, HTTPException, status

from app.dependencies import get_current_user
from app.models.user import User


def is_pro(user: User) -> bool:
    return user.plan == "pro"


def require_pro(current_user: User = Depends(get_current_user)) -> User:
    if not is_pro(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This feature requires a Pro plan.",
        )
    return current_user
