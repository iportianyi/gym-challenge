import secrets
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field, StrictStr, StringConstraints
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, SQLModel, col, or_, select, update

from app.api.players import known_opponents
from app.auth import CurrentPlayerDep
from app.db import SessionDep
from app.models import Game, Guess, Player, Round
from app.rules import Penalty, Played, Settings, Standing, settle

router = APIRouter(prefix="/games", tags=["games"])

Reps = Annotated[int, Field(strict=True, ge=1, le=1000)]
# A guess or an actual count: people in the gym (human's choice in explore: 0–500).
Count = Annotated[int, Field(strict=True, ge=0, le=500)]


class GameCreate(BaseModel):
    # None: an invite game that waits for whoever opens its link (game-invites, design D3).
    opponent_id: Annotated[int, Field(strict=True)] | None = None
    exercise: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=60)]
    base_reps: Reps
    step_reps: Annotated[int, Field(strict=True, ge=0, le=1000)]
    final_reps: Reps


class Move(BaseModel):
    value: Count


class JoinRequest(BaseModel):
    token: StrictStr


class PlayerRef(SQLModel):
    id: int
    name: str


# Per-player values are lists of entries with player_id, the organizer first (design D4).


class PointsPublic(SQLModel):
    player_id: int
    points: int


class PenaltyPublic(SQLModel):
    player_id: int
    reps: int
    doubled: bool


class SettledGuess(SQLModel):
    player_id: int
    value: int


class CurrentGuess(SQLModel):
    player_id: int
    guessed: bool
    value: int | None


class RoundPublic(SQLModel):
    number: int
    guesses: list[SettledGuess]
    actual: int
    winner_id: int | None
    penalty: PenaltyPublic | None


class CurrentRound(SQLModel):
    number: int
    guesses: list[CurrentGuess]


class GamePublic(SQLModel):
    id: int
    organizer: PlayerRef
    opponent: PlayerRef | None
    exercise: str
    base_reps: int
    step_reps: int
    final_reps: int
    status: Literal["waiting", "active", "finished"]
    score: list[PointsPublic]
    winner_id: int | None


class GameDetail(GamePublic):
    final_penalty: PenaltyPublic | None
    rounds: list[RoundPublic]
    current_round: CurrentRound | None
    invite_url: str | None


@dataclass
class GameState:
    """A game with its rounds (by number) and their guesses: everything a response is built from."""

    game: Game
    rounds: list[Round]
    guesses: dict[int, dict[int, int]]  # round id -> player id -> guess

    @property
    def waiting(self) -> bool:
        """No opponent yet: no rounds, no score (game-invites, design D5)."""
        return self.game.opponent_id is None

    @property
    def players(self) -> tuple[int, int]:
        assert self.game.opponent_id is not None  # callers handle a waiting game first
        return (self.game.organizer_id, self.game.opponent_id)

    @property
    def current(self) -> Round | None:
        return next((round_ for round_ in self.rounds if round_.actual is None), None)

    def guesses_of(self, round_: Round) -> dict[int, int]:
        assert round_.id is not None  # loaded from the database
        return self.guesses.get(round_.id, {})

    def played(self) -> list[Played]:
        return [
            Played(guesses=self.guesses_of(round_), actual=round_.actual)
            for round_ in self.rounds
            if round_.actual is not None
        ]

    def standing(self) -> Standing:
        game = self.game
        settings = Settings(game.base_reps, game.step_reps, game.final_reps)
        return settle(self.players, self.played(), settings)


def load_states(session: Session, games: Sequence[Game]) -> list[GameState]:
    """Rounds and guesses of all `games` in two queries, not two per game."""
    game_ids = [game.id for game in games]
    rounds = session.exec(
        select(Round).where(col(Round.game_id).in_(game_ids)).order_by(col(Round.number))
    ).all()
    guesses = session.exec(
        select(Guess).where(col(Guess.round_id).in_([round_.id for round_ in rounds]))
    ).all()
    by_round: dict[int, dict[int, int]] = {}
    for guess in guesses:
        by_round.setdefault(guess.round_id, {})[guess.player_id] = guess.value
    return [
        GameState(
            game=game,
            rounds=[round_ for round_ in rounds if round_.game_id == game.id],
            guesses=by_round,
        )
        for game in games
    ]


def penalty_public(penalty: Penalty | None) -> PenaltyPublic | None:
    if penalty is None:
        return None
    return PenaltyPublic(player_id=penalty.player_id, reps=penalty.reps, doubled=penalty.doubled)


def to_public(state: GameState, players: dict[int, Player]) -> GamePublic:
    game = state.game
    organizer = PlayerRef.model_validate(players[game.organizer_id])
    if state.waiting:
        return GamePublic.model_validate(
            {
                **game.model_dump(),
                "organizer": organizer,
                "opponent": None,
                "score": [],
                "winner_id": None,
            }
        )
    assert game.opponent_id is not None  # not waiting
    standing = state.standing()
    return GamePublic.model_validate(
        {
            **game.model_dump(),
            "organizer": organizer,
            "opponent": PlayerRef.model_validate(players[game.opponent_id]),
            "score": [
                PointsPublic(player_id=player, points=standing.points[player])
                for player in state.players
            ],
            "winner_id": standing.winner_id,
        }
    )


def to_detail(
    state: GameState, players: dict[int, Player], viewer_id: int, invite_link: str
) -> GameDetail:
    """The game as `viewer_id` sees it; `invite_link` is the link without its token."""
    if state.waiting:
        game = state.game
        # Only the organizer can see a waiting game at all (my_game), but say it here too.
        mine = viewer_id == game.organizer_id and game.invite_token is not None
        return GameDetail.model_validate(
            {
                **to_public(state, players).model_dump(),
                "final_penalty": None,
                "rounds": [],
                "current_round": None,
                "invite_url": f"{invite_link}{game.invite_token}" if mine else None,
            }
        )
    standing = state.standing()
    settled = [round_ for round_ in state.rounds if round_.actual is not None]
    rounds = [
        RoundPublic(
            number=round_.number,
            guesses=[
                SettledGuess(player_id=player, value=state.guesses_of(round_)[player])
                for player in state.players
            ],
            actual=round_.actual,
            winner_id=outcome.winner_id,
            penalty=penalty_public(outcome.penalty),
        )
        for round_, outcome in zip(settled, standing.outcomes, strict=True)
        if round_.actual is not None
    ]
    current_round = None
    current = state.current
    if current is not None and standing.winner_id is None:
        made = state.guesses_of(current)
        both = all(player in made for player in state.players)
        current_round = CurrentRound(
            number=current.number,
            guesses=[
                # The opponent's guess stays hidden until both have guessed (design D5).
                CurrentGuess(
                    player_id=player,
                    guessed=player in made,
                    value=made.get(player) if both or player == viewer_id else None,
                )
                for player in state.players
            ],
        )
    return GameDetail.model_validate(
        {
            **to_public(state, players).model_dump(),
            "final_penalty": penalty_public(standing.final_penalty),
            "rounds": rounds,
            "current_round": current_round,
            "invite_url": None,
        }
    )


def players_by_id(session: Session, games: Sequence[Game]) -> dict[int, Player]:
    ids = {game.organizer_id for game in games} | {
        game.opponent_id for game in games if game.opponent_id is not None
    }
    players = session.exec(select(Player).where(col(Player.id).in_(ids))).all()
    return {player.id: player for player in players if player.id is not None}


def my_game(session: Session, game_id: int, me: Player) -> Game:
    """The game if the acting player plays in it; otherwise 404, the same as no game at all."""
    game = session.get(Game, game_id)
    if game is None or me.id not in (game.organizer_id, game.opponent_id):
        raise HTTPException(status_code=404, detail="Game not found")
    return game


def invite_link(request: Request) -> str:
    """The invite link without its token: the bot's Main Mini App with `startapp` (design D2)."""
    return f"https://t.me/{request.app.state.bot_username}?startapp="


InviteLinkDep = Annotated[str, Depends(invite_link)]


def detail_for(session: Session, game: Game, me: Player, link: str) -> GameDetail:
    session.refresh(game)
    [state] = load_states(session, [game])
    assert me.id is not None  # loaded from the database
    return to_detail(state, players_by_id(session, [game]), me.id, link)


@router.post("", status_code=201)
def create_game(body: GameCreate, me: CurrentPlayerDep, session: SessionDep) -> GamePublic:
    assert me.id is not None  # loaded from the database
    settings = body.model_dump(exclude={"opponent_id"})
    if body.opponent_id is None:
        # 16 random bytes as 22 characters of A-Z a-z 0-9 _ -, as Telegram's `startapp` allows.
        game = Game(
            organizer_id=me.id, status="waiting", invite_token=secrets.token_urlsafe(16), **settings
        )
        session.add(game)
        session.commit()
        session.refresh(game)
        return to_public(GameState(game=game, rounds=[], guesses={}), {me.id: me})
    if body.opponent_id == me.id:
        raise HTTPException(status_code=422, detail="Cannot play against yourself")
    # Only someone already played with; an unknown id gets the same answer (design D3).
    opponent = next(
        (known for known in known_opponents(session, me) if known.id == body.opponent_id), None
    )
    if opponent is None:
        raise HTTPException(status_code=422, detail="Opponent not found")
    assert opponent.id is not None  # loaded from the database
    game = Game(organizer_id=me.id, opponent_id=opponent.id, **settings)
    session.add(game)
    session.flush()
    assert game.id is not None  # set by the flush
    # The current round always exists in an active game (design D2).
    first_round = Round(game_id=game.id, number=1)
    session.add(first_round)
    session.commit()
    session.refresh(game)
    session.refresh(first_round)
    state = GameState(game=game, rounds=[first_round], guesses={})
    return to_public(state, {me.id: me, opponent.id: opponent})


@router.get("")
def list_games(me: CurrentPlayerDep, session: SessionDep) -> list[GamePublic]:
    games = session.exec(
        select(Game)
        .where(or_(col(Game.organizer_id) == me.id, col(Game.opponent_id) == me.id))
        .order_by(col(Game.id).desc())
    ).all()
    players = players_by_id(session, games)
    return [to_public(state, players) for state in load_states(session, games)]


@router.post("/join")
def join_game(
    body: JoinRequest, me: CurrentPlayerDep, session: SessionDep, link: InviteLinkDep
) -> GameDetail:
    """The first other player who opens an invite link becomes the opponent (design D4)."""
    game = session.exec(select(Game).where(col(Game.invite_token) == body.token)).first()
    if game is None:
        raise HTTPException(status_code=404, detail="Invite not found")
    used = HTTPException(status_code=409, detail="Invite already used")
    if me.id not in (game.organizer_id, game.opponent_id):
        if game.opponent_id is not None:
            raise used
        assert game.id is not None  # loaded from the database
        # Join only if nobody joined in the meantime (the same guard as enter_actual).
        joined = session.exec(
            update(Game)
            .where(col(Game.id) == game.id, col(Game.opponent_id).is_(None))
            .values(opponent_id=me.id, status="active")
        )
        if joined.rowcount == 0:
            session.rollback()
            session.refresh(game)
            if game.opponent_id != me.id:
                raise used
        else:
            # The current round exists from the first active moment (add-rounds-and-scoring D2).
            session.add(Round(game_id=game.id, number=1))
            session.commit()
    return detail_for(session, game, me, link)


@router.get("/{game_id}")
def get_game(
    game_id: int, me: CurrentPlayerDep, session: SessionDep, link: InviteLinkDep
) -> GameDetail:
    return detail_for(session, my_game(session, game_id, me), me, link)


@router.post("/{game_id}/guesses")
def make_guess(
    game_id: int, body: Move, me: CurrentPlayerDep, session: SessionDep, link: InviteLinkDep
) -> GameDetail:
    game = my_game(session, game_id, me)
    if game.status == "waiting":
        raise HTTPException(status_code=409, detail="Waiting for opponent")
    if game.status == "finished":
        raise HTTPException(status_code=409, detail="Game is finished")
    [state] = load_states(session, [game])
    current = state.current
    assert current is not None and current.id is not None  # an active game has one (design D2)
    assert me.id is not None  # loaded from the database
    already = HTTPException(status_code=409, detail="Already guessed")
    if me.id in state.guesses_of(current):
        raise already
    session.add(Guess(round_id=current.id, player_id=me.id, value=body.value))
    try:
        session.commit()
    except IntegrityError:
        # The same player's other request got in between (a double tap): UNIQUE(round, player).
        session.rollback()
        raise already from None
    return detail_for(session, game, me, link)


@router.post("/{game_id}/actual")
def enter_actual(
    game_id: int, body: Move, me: CurrentPlayerDep, session: SessionDep, link: InviteLinkDep
) -> GameDetail:
    game = my_game(session, game_id, me)
    if me.id != game.organizer_id:
        raise HTTPException(status_code=403, detail="Only the organizer enters the actual count")
    if game.status == "waiting":
        raise HTTPException(status_code=409, detail="Waiting for opponent")
    finished = HTTPException(status_code=409, detail="Game is finished")
    waiting = HTTPException(status_code=409, detail="Waiting for guesses")
    if game.status == "finished":
        raise finished
    [state] = load_states(session, [game])
    current = state.current
    assert current is not None and game.id is not None  # an active game has one (design D2)
    made = state.guesses_of(current)
    if not all(player in made for player in state.players):
        raise waiting
    # Taken before the UPDATE: it also refreshes `current` in the session, which would count twice.
    played = [*state.played(), Played(guesses=made, actual=body.value)]
    # Settle only if nobody settled this round in the meantime (design D3).
    settled = session.exec(
        update(Round)
        .where(col(Round.id) == current.id, col(Round.actual).is_(None))
        .values(actual=body.value, settled_at=datetime.now(UTC))
    )
    if settled.rowcount == 0:
        session.rollback()
        session.refresh(game)
        raise finished if game.status == "finished" else waiting
    standing = settle(
        state.players, played, Settings(game.base_reps, game.step_reps, game.final_reps)
    )
    if standing.winner_id is None:
        session.add(Round(game_id=game.id, number=current.number + 1))
    else:
        game.status = "finished"
        session.add(game)
    session.commit()
    return detail_for(session, game, me, link)
