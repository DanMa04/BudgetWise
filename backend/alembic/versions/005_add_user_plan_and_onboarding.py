"""add plan and onboarding_state to users

Revision ID: 005_user_onboarding
Revises: 004_add_is_fixed
Create Date: 2026-05-30

Note: core tables go through Base.metadata.create_all on app start, so fresh
dev DBs will already have these columns. Existing dev DBs must run
`alembic upgrade head` once to pick them up.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "005_user_onboarding"
down_revision: str | None = "004_add_is_fixed"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "plan",
            sa.String(20),
            nullable=False,
            server_default=sa.text("'basic'"),
        ),
    )
    op.add_column(
        "users",
        sa.Column(
            "onboarding_state",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
    )


def downgrade() -> None:
    op.drop_column("users", "onboarding_state")
    op.drop_column("users", "plan")
