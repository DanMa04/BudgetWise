from datetime import datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import DateTime, Numeric, String, func, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class User(Base):
    __tablename__ = "users"

    auth_provider_id: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    email: Mapped[str | None] = mapped_column(String(255), unique=True, nullable=True)
    display_name: Mapped[str | None] = mapped_column(String(100))
    currency_code: Mapped[str] = mapped_column(String(3), default="USD")
    timezone: Mapped[str] = mapped_column(String(50), default="America/New_York")
    monthly_income_override: Mapped[Decimal | None] = mapped_column(
        Numeric(14, 2), nullable=True
    )
    plan: Mapped[str] = mapped_column(
        String(20), nullable=False, default="basic", server_default=text("'basic'")
    )
    onboarding_state: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, default=dict, server_default=text("'{}'::jsonb")
    )
    community_rules_enabled: Mapped[bool] = mapped_column(
        nullable=False, default=True, server_default=text("true")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    categories: Mapped[list["Category"]] = relationship(back_populates="user")  # noqa: F821
    accounts: Mapped[list["Account"]] = relationship(back_populates="user")  # noqa: F821
    transactions: Mapped[list["Transaction"]] = relationship(back_populates="user")  # noqa: F821
    budgets: Mapped[list["Budget"]] = relationship(back_populates="user")  # noqa: F821
    import_jobs: Mapped[list["ImportJob"]] = relationship(back_populates="user")  # noqa: F821
    plaid_items: Mapped[list["PlaidItem"]] = relationship(back_populates="user")  # noqa: F821
    goals: Mapped[list["Goal"]] = relationship(back_populates="user")  # noqa: F821
