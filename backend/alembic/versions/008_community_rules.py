"""community correction signals + promoted rules + per-user opt-out

Revision ID: 008_community_rules
Revises: 007_transfer_match_all
Create Date: 2026-06-07

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "008_community_rules"
down_revision: str | None = "007_transfer_match_all"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Per-user opt-out flag for cross-user rule learning.
    op.add_column(
        "users",
        sa.Column(
            "community_rules_enabled",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
    )

    # Append-only signal log. `user_hash` is sha256(user_id + salt) — used
    # only to dedupe one user from boosting their own signal count. It is
    # NOT reversible to a user_id without the salt, which is never logged
    # or exposed.
    op.create_table(
        "community_corrections",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("pattern", sa.String(120), nullable=False),
        sa.Column("category_name", sa.String(120), nullable=False),
        sa.Column("user_hash", sa.String(64), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.UniqueConstraint(
            "pattern",
            "category_name",
            "user_hash",
            name="uq_community_corrections_pattern_cat_user",
        ),
    )
    op.create_index(
        "ix_community_corrections_pattern_cat",
        "community_corrections",
        ["pattern", "category_name"],
    )

    # Promotion ledger — records which (pattern, category_name) pairs have
    # crossed the threshold and been turned into rules for existing users.
    # Prevents re-promotion on every aggregation run.
    op.create_table(
        "community_promotions",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("pattern", sa.String(120), nullable=False),
        sa.Column("category_name", sa.String(120), nullable=False),
        sa.Column("contributing_users", sa.Integer(), nullable=False),
        sa.Column(
            "promoted_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.UniqueConstraint(
            "pattern", "category_name", name="uq_community_promotions_pattern_cat"
        ),
    )


def downgrade() -> None:
    op.drop_table("community_promotions")
    op.drop_index(
        "ix_community_corrections_pattern_cat", table_name="community_corrections"
    )
    op.drop_table("community_corrections")
    op.drop_column("users", "community_rules_enabled")
