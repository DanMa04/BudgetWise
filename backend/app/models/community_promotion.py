import uuid
from datetime import datetime

from sqlalchemy import DateTime, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class CommunityPromotion(Base):
    """Ledger of (pattern, category_name) pairs already promoted to rules.

    Prevents re-promotion on every aggregation run.
    """

    __tablename__ = "community_promotions"
    __table_args__ = (
        UniqueConstraint(
            "pattern", "category_name", name="uq_community_promotions_pattern_cat"
        ),
    )

    pattern: Mapped[str] = mapped_column(String(120), nullable=False)
    category_name: Mapped[str] = mapped_column(String(120), nullable=False)
    contributing_users: Mapped[int] = mapped_column(Integer, nullable=False)
    promoted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
