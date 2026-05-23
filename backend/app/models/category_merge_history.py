import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class CategoryMergeHistory(Base):
    __tablename__ = "category_merge_history"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    source_name: Mapped[str] = mapped_column(String(100), nullable=False)
    source_color: Mapped[str | None] = mapped_column(String(7))
    source_icon: Mapped[str | None] = mapped_column(String(50))
    source_is_income: Mapped[bool] = mapped_column(Boolean, default=False)
    target_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("categories.id", ondelete="SET NULL"), nullable=True
    )
    merged_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    transactions_moved: Mapped[int] = mapped_column(Integer, default=0)
    rules_moved: Mapped[int] = mapped_column(Integer, default=0)
    budgets_merged: Mapped[int] = mapped_column(Integer, default=0)
