"""add debt and investment fields to accounts

Revision ID: 003_debt_investment
Revises: 002_add_provider
Create Date: 2026-05-23

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "003_debt_investment"
down_revision: str | None = "002_add_provider"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("accounts", sa.Column("interest_rate", sa.Numeric(6, 3), nullable=True))
    op.add_column("accounts", sa.Column("original_balance", sa.Numeric(14, 2), nullable=True))
    op.add_column("accounts", sa.Column("minimum_payment", sa.Numeric(14, 2), nullable=True))
    op.add_column("accounts", sa.Column("loan_term_months", sa.Integer(), nullable=True))
    op.add_column("accounts", sa.Column("loan_start_date", sa.Date(), nullable=True))
    op.add_column("accounts", sa.Column("return_rate_preset", sa.String(20), nullable=True))
    op.add_column("accounts", sa.Column("custom_return_rate", sa.Numeric(6, 3), nullable=True))


def downgrade() -> None:
    op.drop_column("accounts", "custom_return_rate")
    op.drop_column("accounts", "return_rate_preset")
    op.drop_column("accounts", "loan_start_date")
    op.drop_column("accounts", "loan_term_months")
    op.drop_column("accounts", "minimum_payment")
    op.drop_column("accounts", "original_balance")
    op.drop_column("accounts", "interest_rate")
