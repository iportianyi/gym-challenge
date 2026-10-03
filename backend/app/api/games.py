from collections.abc import Sequence
from typing import Annotated, Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, StringConstraints
from sqlmodel import Session, SQLModel, col, func, or_, select

from app.api.players import CurrentPlayerDep
from app.db import SessionDep
from app.models import Game, Player

router = APIRouter(prefix="/games", tags=["games"])

Reps = Annotated[int, Field(strict=True, ge=1, le=1000)]


class GameCreate(BaseModel):
    opponent_email: Annotated[str, StringConstraints(max_length=254)]
    exercise: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=60)]
    base_reps: Reps
    step_reps: Annotated[int, Field(strict=True, ge=0, le=1000)]
    final_reps: Reps


class PlayerRef(SQLModel):
    id: int
    name: str


class GamePublic(SQLModel):
    id: int
    creator: PlayerRef
    opponent: PlayerRef
    exercise: str
    base_reps: int
    step_reps: int
    final_reps: int
    status: Literal["active"]


def to_public(game: Game, players: dict[int, Player]) -> GamePublic:
    return GamePublic.model_validate(
        {
            **game.model_dump(),
            "creator": PlayerRef.model_validate(players[game.creator_id]),
            "opponent": PlayerRef.model_validate(players[game.opponent_id]),
        }
    )


def players_by_id(session: Session, games: Sequence[Game]) -> dict[int, Player]:
    ids = {game.creator_id for game in games} | {game.opponent_id for game in games}
    players = session.exec(select(Player).where(col(Player.id).in_(ids))).all()
    return {player.id: player for player in players if player.id is not None}


@router.post("", status_code=201)
def create_game(body: GameCreate, me: CurrentPlayerDep, session: SessionDep) -> GamePublic:
    email = body.opponent_email.strip().lower()
    opponent = session.exec(select(Player).where(func.lower(Player.email) == email)).first()
    if opponent is None:
        raise HTTPException(status_code=422, detail="Opponent not found")
    if opponent.id == me.id:
        raise HTTPException(status_code=422, detail="Cannot play against yourself")
    assert me.id is not None and opponent.id is not None  # loaded from the database
    game = Game(
        creator_id=me.id,
        opponent_id=opponent.id,
        **body.model_dump(exclude={"opponent_email"}),
    )
    session.add(game)
    session.commit()
    session.refresh(game)
    return to_public(game, {me.id: me, opponent.id: opponent})


@router.get("")
def list_games(me: CurrentPlayerDep, session: SessionDep) -> list[GamePublic]:
    games = session.exec(
        select(Game)
        .where(or_(col(Game.creator_id) == me.id, col(Game.opponent_id) == me.id))
        .order_by(col(Game.id).desc())
    ).all()
    players = players_by_id(session, games)
    return [to_public(game, players) for game in games]
