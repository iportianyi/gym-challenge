"""players and games, with the two default players

Revision ID: 0001
Revises:
Create Date: 2026-10-03
"""

import sqlalchemy as sa
from alembic import op

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    player = op.create_table(
        "player",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("email", sa.String(), nullable=False, unique=True),
    )
    op.create_table(
        "game",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("creator_id", sa.Integer(), sa.ForeignKey("player.id"), nullable=False),
        sa.Column("opponent_id", sa.Integer(), sa.ForeignKey("player.id"), nullable=False),
        sa.Column("exercise", sa.String(), nullable=False),
        sa.Column("base_reps", sa.Integer(), nullable=False),
        sa.Column("step_reps", sa.Integer(), nullable=False),
        sa.Column("final_reps", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    # The MVP has no sign-up: these two are the only players (docs/spec.md, "Платформа і доступ").
    op.bulk_insert(
        player,
        [
            {"id": 1, "name": "Клієнт", "email": "client@gym.local"},
            {"id": 2, "name": "Тренер", "email": "coach@gym.local"},
        ],
    )


def downgrade() -> None:
    op.drop_table("game")
    op.drop_table("player")
