import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class TransferRule(Base):
    __tablename__ = "transfer_rules"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    source_category_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("categories.id", ondelete="CASCADE"), nullable=False
    )
    target_category_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("categories.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    amount_exact: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    amount_min: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    amount_max: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    day_of_month: Mapped[int | None] = mapped_column(Integer)
    day_tolerance: Mapped[int] = mapped_column(Integer, default=2)
    counterparty_pattern: Mapped[str | None] = mapped_column(String(200))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    priority: Mapped[int] = mapped_column(Integer, default=0)
    match_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    user: Mapped["User"] = relationship()  # noqa: F821
    source_category: Mapped["Category"] = relationship(foreign_keys=[source_category_id])  # noqa: F821
    target_category: Mapped["Category"] = relationship(foreign_keys=[target_category_id])  # noqa: F821
