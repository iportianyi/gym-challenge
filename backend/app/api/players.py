from typing import Annotated

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, StringConstraints
from sqlalchemy.exc import IntegrityError
from sqlmodel import SQLModel, col, or_, select

from app.auth import CurrentPlayerDep, TelegramUserDep
from app.db import SessionDep
from app.models import Game, Player, TelegramAccount

router = APIRouter(tags=["players"])


class PlayerPublic(SQLModel):
    id: int
    name: str


class Registration(BaseModel):
    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=40)]


def account_player(session: SessionDep, telegram_user_id: int) -> Player | None:
    account = session.get(TelegramAccount, telegram_user_id)
    return session.get(Player, account.player_id) if account is not None else None


@router.get("/me")
def get_me(user: TelegramUserDep, session: SessionDep) -> PlayerPublic:
    player = account_player(session, user.id)
    if player is None:
        raise HTTPException(status_code=404, detail="Not registered")
    return PlayerPublic.model_validate(player)


@router.post("/me", status_code=201)
def register_me(body: Registration, user: TelegramUserDep, session: SessionDep) -> PlayerPublic:
    already = HTTPException(status_code=409, detail="Already registered")
    if account_player(session, user.id) is not None:
        raise already
    player = Player(name=body.name)
    session.add(player)
    session.flush()
    assert player.id is not None  # set by the flush
    session.add(TelegramAccount(telegram_user_id=user.id, player_id=player.id))
    try:
        session.commit()
    except IntegrityError:
        # The same user's other request got in between (a double tap, two tabs): the account's
        # primary key.
        session.rollback()
        raise already from None
    session.refresh(player)
    return PlayerPublic.model_validate(player)


def known_opponents(session: SessionDep, me: Player) -> list[Player]:
    """Players who share a game with `me` (as organizer and opponent), the most recent first.

    A waiting game has no opponent yet, so it makes nobody known (game-invites, design D3).
    """
    games = session.exec(
        select(Game)
        .where(
            col(Game.opponent_id).is_not(None),
            or_(col(Game.organizer_id) == me.id, col(Game.opponent_id) == me.id),
        )
        .order_by(col(Game.id).desc())
    ).all()
    order: list[int] = []
    for game in games:
        other = game.opponent_id if game.organizer_id == me.id else game.organizer_id
        if other is not None and other not in order:
            order.append(other)
    players = session.exec(select(Player).where(col(Player.id).in_(order))).all()
    by_id = {player.id: player for player in players}
    return [by_id[player_id] for player_id in order]


@router.get("/opponents")
def list_opponents(me: CurrentPlayerDep, session: SessionDep) -> list[PlayerPublic]:
    return [PlayerPublic.model_validate(player) for player in known_opponents(session, me)]
