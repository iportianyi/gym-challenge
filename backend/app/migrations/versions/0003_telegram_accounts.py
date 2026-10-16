"""players log in with Telegram: telegram_account, no email, the MVP players and games deleted

Revision ID: 0003
Revises: 0002
Create Date: 2026-10-16
"""

import sqlalchemy as sa
from alembic import op

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Spec v2.0: the default players Клієнт and Тренер and all their games were local test data.
    # Before v2 they are the only players, so deleting everything deletes exactly them and their
    # games.
    for table in ("guess", "round", "game", "player"):
        op.execute(f"DELETE FROM {table}")
    # SQLite cannot drop a column with a UNIQUE constraint in place; batch mode recreates the table.
    with op.batch_alter_table("player") as batch:
        batch.drop_column("email")
    op.create_table(
        "telegram_account",
        sa.Column("telegram_user_id", sa.BigInteger(), primary_key=True, autoincrement=False),
        sa.Column(
            "player_id", sa.Integer(), sa.ForeignKey("player.id"), nullable=False, unique=True
        ),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )


def downgrade() -> None:
    # Schema only: the deleted players and games do not come back.
    op.drop_table("telegram_account")
    with op.batch_alter_table("player") as batch:
        batch.add_column(sa.Column("email", sa.String(), nullable=True))
