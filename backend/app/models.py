from datetime import UTC, datetime

from sqlalchemy import BigInteger, Column, UniqueConstraint
from sqlmodel import Field, SQLModel


class Player(SQLModel, table=True):
    # Apart from how the person logs in, so other login methods can be added later
    # (docs/spec.md v2.0).
    id: int | None = Field(default=None, primary_key=True)
    name: str


class TelegramAccount(SQLModel, table=True):
    # Telegram user ids do not fit in 32 bits. The primary key makes one account belong to one
    # player.
    __tablename__ = "telegram_account"

    telegram_user_id: int = Field(
        sa_column=Column(BigInteger, primary_key=True, autoincrement=False)
    )
    player_id: int = Field(foreign_key="player.id", unique=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


class Game(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    organizer_id: int = Field(foreign_key="player.id")
    # None while the game waits for someone to open its invite link (game-invites, design D1).
    opponent_id: int | None = Field(default=None, foreign_key="player.id")
    # The `startapp` token of the invite link; kept after the join, so a second opener is told the
    # link is used. None for a game started with a known opponent.
    invite_token: str | None = Field(default=None, max_length=32, unique=True)
    # One penalty exercise per game; round and final penalties differ only in reps (docs/spec.md).
    exercise: str
    base_reps: int
    step_reps: int
    final_reps: int
    status: str = "active"  # "waiting" | "active" | "finished"
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


class Round(SQLModel, table=True):
    # An active game always has exactly one round with actual IS NULL: the current one (design D2).
    __table_args__ = (UniqueConstraint("game_id", "number"),)

    id: int | None = Field(default=None, primary_key=True)
    game_id: int = Field(foreign_key="game.id")
    number: int
    actual: int | None = None
    # Not in the API; kept for gym-load statistics, a listed next step in docs/spec.md.
    settled_at: datetime | None = None


class Guess(SQLModel, table=True):
    # One guess per player per round; a double tap hits this constraint (design D3).
    __table_args__ = (UniqueConstraint("round_id", "player_id"),)

    id: int | None = Field(default=None, primary_key=True)
    round_id: int = Field(foreign_key="round.id")
    player_id: int = Field(foreign_key="player.id")
    value: int
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
