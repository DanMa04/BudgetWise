"""add is_fixed to categories

Revision ID: 004_add_is_fixed
Revises: 003_debt_investment
Create Date: 2026-05-25

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "004_add_is_fixed"
down_revision: str | None = "003_debt_investment"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "categories",
        sa.Column("is_fixed", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )
    op.execute(
        "UPDATE categories SET is_fixed = true WHERE is_system = true "
        "AND name IN ('Housing', 'Utilities', 'Insurance', 'Car Payment', 'Subscriptions')"
    )


def downgrade() -> None:
    op.drop_column("categories", "is_fixed")
