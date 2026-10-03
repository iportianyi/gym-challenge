from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlmodel import SQLModel, col, select

from app.db import SessionDep
from app.models import Player

router = APIRouter(tags=["players"])


class PlayerPublic(SQLModel):
    id: int
    name: str
    email: str


@router.get("/players")
def list_players(session: SessionDep) -> list[PlayerPublic]:
    players = session.exec(select(Player).order_by(col(Player.id))).all()
    return [PlayerPublic.model_validate(player) for player in players]


def current_player(
    session: SessionDep, x_player_id: Annotated[str | None, Header()] = None
) -> Player:
    """The acting player from `X-Player-Id`. Read as a string so a bad value is a 401, not a 422.

    Not authentication: anyone can send any id (docs/spec.md v1.3 accepts this for the MVP).
    """
    unknown = HTTPException(status_code=401, detail="Unknown player")
    if x_player_id is None or not (x_player_id.isascii() and x_player_id.isdecimal()):
        raise unknown
    player = session.get(Player, int(x_player_id))
    if player is None:
        raise unknown
    return player


CurrentPlayerDep = Annotated[Player, Depends(current_player)]
