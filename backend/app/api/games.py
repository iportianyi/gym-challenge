from collections.abc import Sequence
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Annotated, Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, StringConstraints
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, SQLModel, col, func, or_, select, update

from app.api.players import CurrentPlayerDep
from app.db import SessionDep
from app.models import Game, Guess, Player, Round
from app.rules import Penalty, Played, Settings, Standing, settle

router = APIRouter(prefix="/games", tags=["games"])

Reps = Annotated[int, Field(strict=True, ge=1, le=1000)]
# A guess or an actual count: people in the gym (human's choice in explore: 0–500).
Count = Annotated[int, Field(strict=True, ge=0, le=500)]


class GameCreate(BaseModel):
    opponent_email: Annotated[str, StringConstraints(max_length=254)]
    exercise: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=60)]
    base_reps: Reps
    step_reps: Annotated[int, Field(strict=True, ge=0, le=1000)]
    final_reps: Reps


class Move(BaseModel):
    value: Count


class PlayerRef(SQLModel):
    id: int
    name: str


# Per-player values are lists of entries with player_id, the creator first (design D4).


class PointsPublic(SQLModel):
    player_id: int
    points: int


class PenaltyPublic(SQLModel):
    player_id: int
    reps: int


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
    creator: PlayerRef
    opponent: PlayerRef
    exercise: str
    base_reps: int
    step_reps: int
    final_reps: int
    status: Literal["active", "finished"]
    score: list[PointsPublic]
    winner_id: int | None


class GameDetail(GamePublic):
    final_penalty: PenaltyPublic | None
    rounds: list[RoundPublic]
    current_round: CurrentRound | None


@dataclass
class GameState:
    """A game with its rounds (by number) and their guesses: everything a response is built from."""

    game: Game
    rounds: list[Round]
    guesses: dict[int, dict[int, int]]  # round id -> player id -> guess

    @property
    def players(self) -> tuple[int, int]:
        return (self.game.creator_id, self.game.opponent_id)

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
    return PenaltyPublic(player_id=penalty.player_id, reps=penalty.reps)


def to_public(state: GameState, players: dict[int, Player]) -> GamePublic:
    game, standing = state.game, state.standing()
    return GamePublic.model_validate(
        {
            **game.model_dump(),
            "creator": PlayerRef.model_validate(players[game.creator_id]),
            "opponent": PlayerRef.model_validate(players[game.opponent_id]),
            "score": [
                PointsPublic(player_id=player, points=standing.points[player])
                for player in state.players
            ],
            "winner_id": standing.winner_id,
        }
    )


def to_detail(state: GameState, players: dict[int, Player], viewer_id: int) -> GameDetail:
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
        }
    )


def players_by_id(session: Session, games: Sequence[Game]) -> dict[int, Player]:
    ids = {game.creator_id for game in games} | {game.opponent_id for game in games}
    players = session.exec(select(Player).where(col(Player.id).in_(ids))).all()
    return {player.id: player for player in players if player.id is not None}


def my_game(session: Session, game_id: int, me: Player) -> Game:
    """The game if the acting player plays in it; otherwise 404, the same as no game at all."""
    game = session.get(Game, game_id)
    if game is None or me.id not in (game.creator_id, game.opponent_id):
        raise HTTPException(status_code=404, detail="Game not found")
    return game


def detail_for(session: Session, game: Game, me: Player) -> GameDetail:
    session.refresh(game)
    [state] = load_states(session, [game])
    assert me.id is not None  # loaded from the database
    return to_detail(state, players_by_id(session, [game]), me.id)


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
        .where(or_(col(Game.creator_id) == me.id, col(Game.opponent_id) == me.id))
        .order_by(col(Game.id).desc())
    ).all()
    players = players_by_id(session, games)
    return [to_public(state, players) for state in load_states(session, games)]


@router.get("/{game_id}")
def get_game(game_id: int, me: CurrentPlayerDep, session: SessionDep) -> GameDetail:
    return detail_for(session, my_game(session, game_id, me), me)


@router.post("/{game_id}/guesses")
def make_guess(game_id: int, body: Move, me: CurrentPlayerDep, session: SessionDep) -> GameDetail:
    game = my_game(session, game_id, me)
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
    return detail_for(session, game, me)


@router.post("/{game_id}/actual")
def enter_actual(game_id: int, body: Move, me: CurrentPlayerDep, session: SessionDep) -> GameDetail:
    game = my_game(session, game_id, me)
    if me.id != game.creator_id:
        raise HTTPException(status_code=403, detail="Only the creator enters the actual count")
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
    return detail_for(session, game, me)
