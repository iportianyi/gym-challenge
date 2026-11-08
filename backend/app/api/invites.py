"""Reading an invite before joining its game (invite-preview-accept, design D1)."""

from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlmodel import col, select

from app.api.games import JoinRequest
from app.api.players import PlayerPublic, account_player
from app.auth import TelegramUserDep
from app.db import SessionDep
from app.models import Game, Player

router = APIRouter(prefix="/invites", tags=["invites"])


class InvitePreview(BaseModel):
    organizer: PlayerPublic
    exercise: str
    base_reps: int
    step_reps: int
    final_reps: int
    # organizer: their own link; opponent: they have joined; invited: they may still join.
    role: Literal["organizer", "opponent", "invited"]


@router.post("/preview")
def preview_invite(body: JoinRequest, user: TelegramUserDep, session: SessionDep) -> InvitePreview:
    """Who invites and to what, for any Telegram login, even before the person has a player.

    Reads only: joining stays with `POST /api/games/join`. The token is in the body, as for join, so
    it never lands in a URL or an access log.
    """
    game = session.exec(select(Game).where(col(Game.invite_token) == body.token)).first()
    if game is None:
        raise HTTPException(status_code=404, detail="Invite not found")
    viewer = account_player(session, user.id)
    viewer_id = viewer.id if viewer is not None else None
    if viewer_id is not None and viewer_id == game.organizer_id:
        role = "organizer"
    elif viewer_id is not None and viewer_id == game.opponent_id:
        role = "opponent"
    elif game.opponent_id is not None:
        raise HTTPException(status_code=409, detail="Invite already used")
    else:
        role = "invited"
    organizer = session.get(Player, game.organizer_id)
    assert organizer is not None  # a foreign key of the game
    return InvitePreview(
        organizer=PlayerPublic.model_validate(organizer),
        exercise=game.exercise,
        base_reps=game.base_reps,
        step_reps=game.step_reps,
        final_reps=game.final_reps,
        role=role,
    )
