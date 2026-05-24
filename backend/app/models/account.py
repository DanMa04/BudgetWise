import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Account(Base):
    __tablename__ = "accounts"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    account_type: Mapped[str] = mapped_column(String(20), nullable=False)
    institution_name: Mapped[str | None] = mapped_column(String(100))
    currency_code: Mapped[str] = mapped_column(String(3), default="USD")
    current_balance: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    plaid_item_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("plaid_items.id"), nullable=True
    )
    plaid_account_id: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # Debt fields (loan, credit)
    interest_rate: Mapped[Decimal | None] = mapped_column(Numeric(6, 3), nullable=True)
    original_balance: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)
    minimum_payment: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)
    loan_term_months: Mapped[int | None] = mapped_column(Integer, nullable=True)
    loan_start_date: Mapped[date | None] = mapped_column(Date, nullable=True)

    # Investment fields
    return_rate_preset: Mapped[str | None] = mapped_column(String(20), nullable=True)
    custom_return_rate: Mapped[Decimal | None] = mapped_column(Numeric(6, 3), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    user: Mapped["User"] = relationship(back_populates="accounts")  # noqa: F821
    plaid_item: Mapped["PlaidItem | None"] = relationship(  # noqa: F821
        back_populates="accounts"
    )
    transactions: Mapped[list["Transaction"]] = relationship(  # noqa: F821
        back_populates="account"
    )
