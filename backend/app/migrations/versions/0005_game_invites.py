"""invite games: game.opponent_id may be empty while the game waits, game.invite_token

Revision ID: 0005
Revises: 0004
Create Date: 2026-10-17
"""

import sqlalchemy as sa
from alembic import op

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # SQLite cannot drop NOT NULL in place: batch mode copies `game`, drops it and renames the copy
    # (foreign keys are off during migrations, app.db.migrate).
    with op.batch_alter_table("game") as batch:
        batch.alter_column("opponent_id", existing_type=sa.Integer(), nullable=True)
        batch.add_column(sa.Column("invite_token", sa.String(length=32), nullable=True))
        batch.create_unique_constraint("uq_game_invite_token", ["invite_token"])


def downgrade() -> None:
    # A waiting game has no opponent and no rounds; it cannot exist before invitations.
    op.execute("DELETE FROM game WHERE opponent_id IS NULL")
    with op.batch_alter_table("game") as batch:
        batch.drop_constraint("uq_game_invite_token", type_="unique")
        batch.drop_column("invite_token")
        batch.alter_column("opponent_id", existing_type=sa.Integer(), nullable=False)
