import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, JSON, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class CategorySnapshot(Base):
    __tablename__ = "category_snapshots"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    trigger: Mapped[str] = mapped_column(String(50), nullable=False)
    categories: Mapped[dict] = mapped_column(JSON, nullable=False)
    categorization_rules: Mapped[dict] = mapped_column(JSON, nullable=False)
    transfer_rules: Mapped[dict] = mapped_column(JSON, nullable=False)
    transaction_assignments: Mapped[dict] = mapped_column(JSON, nullable=False)
    category_count: Mapped[int] = mapped_column(Integer, default=0)
    rule_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    user: Mapped["User"] = relationship()
