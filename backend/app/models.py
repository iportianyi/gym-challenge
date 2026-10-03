from datetime import UTC, datetime

from sqlalchemy import UniqueConstraint
from sqlmodel import Field, SQLModel


class Player(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    name: str
    email: str = Field(unique=True)


class Game(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    creator_id: int = Field(foreign_key="player.id")
    opponent_id: int = Field(foreign_key="player.id")
    # One penalty exercise per game; round and final penalties differ only in reps (docs/spec.md).
    exercise: str
    base_reps: int
    step_reps: int
    final_reps: int
    status: str = "active"
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
