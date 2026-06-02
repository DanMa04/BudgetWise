"""add match_all_categories to transfer_rules

Revision ID: 007_transfer_match_all
Revises: 006_transfer_match_type
Create Date: 2026-05-31

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "007_transfer_match_all"
down_revision: str | None = "006_transfer_match_type"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "transfer_rules",
        sa.Column(
            "match_all_categories",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )


def downgrade() -> None:
    op.drop_column("transfer_rules", "match_all_categories")
