"""Game rules (docs/spec.md, "Правила гри" 1–7) as a pure function: no database, no HTTP.

Only facts are stored (guesses and actual counts); score, loss streaks, penalties and the game
winner are always recomputed here from the settled rounds, so they cannot drift from the history.
"""

from collections.abc import Mapping, Sequence
from dataclasses import dataclass

WINNING_SCORE = 5


@dataclass(frozen=True)
class Settings:
    base_reps: int
    step_reps: int
    final_reps: int


@dataclass(frozen=True)
class Played:
    """A settled round: each player's guess (player_id -> guess) and the actual count."""

    guesses: Mapping[int, int]
    actual: int


@dataclass(frozen=True)
class Penalty:
    player_id: int
    reps: int


@dataclass(frozen=True)
class Outcome:
    winner_id: int | None  # None: a draw
    penalty: Penalty | None


@dataclass(frozen=True)
class Standing:
    outcomes: tuple[Outcome, ...]
    points: dict[int, int]
    winner_id: int | None
    final_penalty: Penalty | None


def settle(players: tuple[int, int], rounds: Sequence[Played], settings: Settings) -> Standing:
    """Walk the settled rounds of a game between `players` (creator, opponent) in order."""
    points = dict.fromkeys(players, 0)
    streaks = dict.fromkeys(players, 0)  # rounds lost in a row
    outcomes: list[Outcome] = []
    winner_id: int | None = None
    final_penalty: Penalty | None = None

    for played in rounds:
        if winner_id is not None:
            raise ValueError("a round after the game was won")
        if set(played.guesses) != set(players):
            raise ValueError(f"guesses {sorted(played.guesses)} are not from players {players}")

        first, second = (abs(played.guesses[player] - played.actual) for player in players)
        if first == second:
            # Rule 4: a draw gives no point, no penalty and ends both streaks.
            streaks = dict.fromkeys(players, 0)
            outcomes.append(Outcome(winner_id=None, penalty=None))
            continue

        winner, loser = players if first < second else players[::-1]
        points[winner] += 1
        streaks[winner] = 0
        streaks[loser] += 1
        if points[winner] == WINNING_SCORE:
            # Rule 7: the last round has no round penalty, only the final one.
            winner_id = winner
            final_penalty = Penalty(player_id=loser, reps=settings.final_reps)
            outcomes.append(Outcome(winner_id=winner, penalty=None))
        else:
            # Rule 5: base + (n - 1) * step, n = the loser's losses in a row.
            reps = settings.base_reps + (streaks[loser] - 1) * settings.step_reps
            outcomes.append(Outcome(winner_id=winner, penalty=Penalty(player_id=loser, reps=reps)))

    return Standing(
        outcomes=tuple(outcomes), points=points, winner_id=winner_id, final_penalty=final_penalty
    )
