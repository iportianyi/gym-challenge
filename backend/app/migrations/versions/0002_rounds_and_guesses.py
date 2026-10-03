"""rounds and guesses; round 1 for every active game

Revision ID: 0002
Revises: 0001
Create Date: 2026-10-03
"""

import sqlalchemy as sa
from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "round",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("game_id", sa.Integer(), sa.ForeignKey("game.id"), nullable=False),
        sa.Column("number", sa.Integer(), nullable=False),
        sa.Column("actual", sa.Integer(), nullable=True),
        sa.Column("settled_at", sa.DateTime(), nullable=True),
        sa.UniqueConstraint("game_id", "number"),
    )
    op.create_table(
        "guess",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("round_id", sa.Integer(), sa.ForeignKey("round.id"), nullable=False),
        sa.Column("player_id", sa.Integer(), sa.ForeignKey("player.id"), nullable=False),
        sa.Column("value", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("round_id", "player_id"),
    )
    # Games created before rounds existed get their current round, so they can be played.
    op.execute("INSERT INTO round (game_id, number) SELECT id, 1 FROM game WHERE status = 'active'")


def downgrade() -> None:
    op.drop_table("guess")
    op.drop_table("round")
