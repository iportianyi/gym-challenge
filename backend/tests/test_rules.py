"""Scenarios from openspec/changes/add-rounds-and-scoring/specs/scoring/spec.md,
on the pure rules module."""

import pytest

from app.rules import Penalty, Played, Settings, settle

PLAYERS = (1, 2)  # (creator, opponent)
SETTINGS = Settings(base_reps=10, step_reps=5, final_reps=30)


def played(guess_1: int, guess_2: int, actual: int) -> Played:
    """A round written as in the spec: (guess of 1, guess of 2, actual)."""
    return Played(guesses={1: guess_1, 2: guess_2}, actual=actual)


WIN_1 = played(40, 60, 45)  # player 2 loses
WIN_2 = played(60, 40, 45)  # player 1 loses
DRAW = played(40, 50, 45)


# Requirement: The closer guess wins the round


def test_player_1_is_closer() -> None:
    standing = settle(PLAYERS, [played(40, 55, 47)], SETTINGS)

    assert standing.outcomes[0].winner_id == 1
    assert standing.points == {1: 1, 2: 0}


def test_exact_guess() -> None:
    standing = settle(PLAYERS, [played(50, 47, 47)], SETTINGS)

    assert standing.outcomes[0].winner_id == 2


# Requirement: Equal distances are a draw


def test_draw() -> None:
    standing = settle(PLAYERS, [played(40, 54, 47)], SETTINGS)

    assert standing.outcomes[0].winner_id is None
    assert standing.outcomes[0].penalty is None
    assert standing.points == {1: 0, 2: 0}


# Requirement: The round loser does a penalty that grows in a loss streak


def test_three_losses_in_a_row() -> None:
    standing = settle(PLAYERS, [WIN_1, WIN_1, WIN_1], SETTINGS)

    assert [outcome.penalty for outcome in standing.outcomes] == [
        Penalty(player_id=2, reps=10),
        Penalty(player_id=2, reps=15),
        Penalty(player_id=2, reps=20),
    ]


def test_own_win_ends_the_streak() -> None:
    standing = settle(PLAYERS, [WIN_1, WIN_1, WIN_2, WIN_1], SETTINGS)

    assert [outcome.penalty for outcome in standing.outcomes] == [
        Penalty(player_id=2, reps=10),
        Penalty(player_id=2, reps=15),
        Penalty(player_id=1, reps=10),
        Penalty(player_id=2, reps=10),
    ]


def test_draw_ends_the_streak() -> None:
    standing = settle(PLAYERS, [WIN_1, WIN_1, DRAW, WIN_1], SETTINGS)

    assert [outcome.penalty for outcome in standing.outcomes] == [
        Penalty(player_id=2, reps=10),
        Penalty(player_id=2, reps=15),
        None,
        Penalty(player_id=2, reps=10),
    ]


def test_zero_step_keeps_the_reps() -> None:
    settings = Settings(base_reps=10, step_reps=0, final_reps=30)

    standing = settle(PLAYERS, [WIN_1, WIN_1, WIN_1], settings)

    assert [outcome.penalty for outcome in standing.outcomes] == [Penalty(player_id=2, reps=10)] * 3


# Requirement: The first player to 5 points wins the game


def test_four_points_is_not_the_end() -> None:
    standing = settle(PLAYERS, [WIN_1] * 4, SETTINGS)

    assert standing.winner_id is None
    assert standing.final_penalty is None
    assert standing.points == {1: 4, 2: 0}


def test_fifth_point_ends_the_game() -> None:
    standing = settle(PLAYERS, [WIN_1] * 5, SETTINGS)

    assert standing.winner_id == 1
    assert standing.points == {1: 5, 2: 0}
    assert standing.final_penalty == Penalty(player_id=2, reps=30)
    assert [outcome.penalty for outcome in standing.outcomes] == [
        Penalty(player_id=2, reps=10),
        Penalty(player_id=2, reps=15),
        Penalty(player_id=2, reps=20),
        Penalty(player_id=2, reps=25),
        None,
    ]


# Guards of the module itself (design D1), not spec scenarios


def test_no_rounds_after_the_game_is_won() -> None:
    with pytest.raises(ValueError):
        settle(PLAYERS, [WIN_1] * 6, SETTINGS)


def test_guesses_must_be_from_the_two_players() -> None:
    with pytest.raises(ValueError):
        settle(PLAYERS, [Played(guesses={1: 40, 3: 50}, actual=45)], SETTINGS)
