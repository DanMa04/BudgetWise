"""add counterparty_match_type to transfer_rules

Revision ID: 006_transfer_match_type
Revises: 005_user_onboarding
Create Date: 2026-05-31

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "006_transfer_match_type"
down_revision: str | None = "005_user_onboarding"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "transfer_rules",
        sa.Column(
            "counterparty_match_type",
            sa.String(20),
            nullable=False,
            server_default=sa.text("'contains'"),
        ),
    )


def downgrade() -> None:
    op.drop_column("transfer_rules", "counterparty_match_type")
