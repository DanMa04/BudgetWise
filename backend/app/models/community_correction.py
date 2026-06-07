import uuid
from datetime import datetime

from sqlalchemy import DateTime, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class CommunityCorrection(Base):
    """Append-only signal log for cross-user rule learning.

    A signal is one (cleaned merchant pattern, target category name) pair
    contributed by one (hashed) user. The hash is deterministic per user
    so we can dedupe — one user correcting the same merchant 50 times
    still counts as one signal — but it is irreversible without the salt.

    Stores no raw transaction descriptions or user IDs.
    """

    __tablename__ = "community_corrections"
    __table_args__ = (
        UniqueConstraint(
            "pattern",
            "category_name",
            "user_hash",
            name="uq_community_corrections_pattern_cat_user",
        ),
    )

    pattern: Mapped[str] = mapped_column(String(120), nullable=False)
    category_name: Mapped[str] = mapped_column(String(120), nullable=False)
    user_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
