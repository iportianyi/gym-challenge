"""game.creator_id is game.organizer_id: the player who created the game is its organizer

Revision ID: 0004
Revises: 0003
Create Date: 2026-10-16
"""

from alembic import op

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Spec v2.0 calls this player the organizer. SQLite renames the column in place (3.25+), keeping
    # rows, NOT NULL and the foreign key. Not batch mode: it would copy and drop `game`, and with
    # foreign keys on, dropping a game that rounds point to fails.
    op.execute("ALTER TABLE game RENAME COLUMN creator_id TO organizer_id")


def downgrade() -> None:
    op.execute("ALTER TABLE game RENAME COLUMN organizer_id TO creator_id")
