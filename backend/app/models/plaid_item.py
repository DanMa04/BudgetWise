import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class PlaidItem(Base):
    __tablename__ = "plaid_items"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    institution_id: Mapped[str] = mapped_column(String(100), nullable=False)
    institution_name: Mapped[str] = mapped_column(String(200), nullable=False)
    access_token: Mapped[str] = mapped_column(String(500), nullable=False)
    item_id: Mapped[str] = mapped_column(String(200), nullable=False)
    sync_cursor: Mapped[str | None] = mapped_column(String(500))
    status: Mapped[str] = mapped_column(String(20), default="active")
    last_synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    error_message: Mapped[str | None] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    user: Mapped["User"] = relationship(back_populates="plaid_items")  # noqa: F821
    accounts: Mapped[list["Account"]] = relationship(back_populates="plaid_item")  # noqa: F821
