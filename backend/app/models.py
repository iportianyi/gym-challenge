from datetime import UTC, datetime

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
