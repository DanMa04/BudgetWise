"""add provider column to plaid_items

Revision ID: 002_add_provider
Revises: 001_notifications
Create Date: 2026-05-14

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "002_add_provider"
down_revision: str | None = "001_notifications"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "plaid_items",
        sa.Column("provider", sa.String(20), nullable=False, server_default="plaid"),
    )


def downgrade() -> None:
    op.drop_column("plaid_items", "provider")
