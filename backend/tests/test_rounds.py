"""API scenarios from openspec/specs/rounds/spec.md, plus "Full game through the API" from
specs/scoring/spec.md, as changed by the telegram-auth deltas (players act through Telegram
logins)."""

from collections.abc import Callable
from typing import Any

import httpx
import pytest
from fastapi.testclient import TestClient

from tests.conftest import as_player, register

pytestmark = pytest.mark.usefixtures("players")

NEW_GAME: dict[str, Any] = {
    "opponent_id": 2,
    "exercise": "Присідання",
    "base_reps": 10,
    "step_reps": 5,
    "final_reps": 30,
}

NO_GUESSES = [
    {"player_id": 1, "guessed": False, "value": None},
    {"player_id": 2, "guessed": False, "value": None},
]


def new_game(client: TestClient) -> int:
    response = client.post("/api/games", headers=as_player(1), json=NEW_GAME)
    assert response.status_code == 201
    return response.json()["id"]


def guess(client: TestClient, game_id: int, headers: dict[str, str], value: Any) -> httpx.Response:
    return client.post(f"/api/games/{game_id}/guesses", headers=headers, json={"value": value})


def actual(client: TestClient, game_id: int, headers: dict[str, str], value: Any) -> httpx.Response:
    return client.post(f"/api/games/{game_id}/actual", headers=headers, json={"value": value})


def detail(client: TestClient, game_id: int, player: int = 1) -> dict[str, Any]:
    response = client.get(f"/api/games/{game_id}", headers=as_player(player))
    assert response.status_code == 200
    return response.json()


def play(client: TestClient, game_id: int, guess_1: int, guess_2: int, count: int) -> None:
    """One whole round: player 1 (the creator) guesses, player 2 guesses, player 1 settles it."""
    assert guess(client, game_id, as_player(1), guess_1).status_code == 200
    assert guess(client, game_id, as_player(2), guess_2).status_code == 200
    assert actual(client, game_id, as_player(1), count).status_code == 200


# Requirement: A participant sees one game with its rounds


def test_new_game(client: TestClient) -> None:
    game_id = new_game(client)

    response = client.get(f"/api/games/{game_id}", headers=as_player(2))

    assert response.status_code == 200
    assert response.json() == {
        "id": 1,
        "creator": {"id": 1, "name": "Клієнт"},
        "opponent": {"id": 2, "name": "Тренер"},
        "exercise": "Присідання",
        "base_reps": 10,
        "step_reps": 5,
        "final_reps": 30,
        "status": "active",
        "score": [{"player_id": 1, "points": 0}, {"player_id": 2, "points": 0}],
        "winner_id": None,
        "final_penalty": None,
        "rounds": [],
        "current_round": {"number": 1, "guesses": NO_GUESSES},
    }


def test_one_settled_round(client: TestClient) -> None:
    game_id = new_game(client)
    play(client, game_id, 40, 55, 47)

    game = detail(client, game_id, 1)

    assert game["rounds"] == [
        {
            "number": 1,
            "guesses": [{"player_id": 1, "value": 40}, {"player_id": 2, "value": 55}],
            "actual": 47,
            "winner_id": 1,
            "penalty": {"player_id": 2, "reps": 10, "doubled": False},
        }
    ]
    assert game["current_round"] == {"number": 2, "guesses": NO_GUESSES}
    assert game["score"] == [{"player_id": 1, "points": 1}, {"player_id": 2, "points": 0}]


# Requirement: Only the game's players can see or play it


def test_no_such_game(client: TestClient) -> None:
    response = client.get("/api/games/99", headers=as_player(1))

    assert response.status_code == 404
    assert response.json() == {"detail": "Game not found"}


def test_someone_elses_game(client: TestClient) -> None:
    register(client, 3)
    game_id = new_game(client)

    response = guess(client, game_id, as_player(3), 40)

    assert response.status_code == 404
    assert response.json() == {"detail": "Game not found"}
    entries = detail(client, game_id)["current_round"]["guesses"]
    assert not any(entry["guessed"] for entry in entries)


# Requirement: A player makes one guess per round


def test_first_guess(client: TestClient) -> None:
    game_id = new_game(client)

    response = guess(client, game_id, as_player(1), 40)

    assert response.status_code == 200
    assert response.json()["current_round"] == {
        "number": 1,
        "guesses": [
            {"player_id": 1, "guessed": True, "value": 40},
            {"player_id": 2, "guessed": False, "value": None},
        ],
    }


def test_second_guess_in_the_same_round(client: TestClient) -> None:
    game_id = new_game(client)
    assert guess(client, game_id, as_player(1), 40).status_code == 200

    response = guess(client, game_id, as_player(1), 41)

    assert response.status_code == 409
    assert response.json() == {"detail": "Already guessed"}
    assert detail(client, game_id)["current_round"]["guesses"][0] == {
        "player_id": 1,
        "guessed": True,
        "value": 40,
    }


def test_bounds_are_inclusive(client: TestClient) -> None:
    game_id = new_game(client)

    assert guess(client, game_id, as_player(1), 0).status_code == 200
    assert guess(client, game_id, as_player(2), 500).status_code == 200


def test_guess_out_of_range(client: TestClient) -> None:
    game_id = new_game(client)

    assert guess(client, game_id, as_player(1), 501).status_code == 422
    assert guess(client, game_id, as_player(1), -1).status_code == 422
    assert detail(client, game_id)["current_round"]["guesses"][0] == {
        "player_id": 1,
        "guessed": False,
        "value": None,
    }


def test_guess_is_not_a_whole_number(client: TestClient) -> None:
    game_id = new_game(client)

    assert guess(client, game_id, as_player(1), "40").status_code == 422
    assert guess(client, game_id, as_player(1), 40.5).status_code == 422


# Requirement: The opponent's guess stays hidden until both have guessed


def test_opponent_sees_that_i_guessed_but_not_the_number(client: TestClient) -> None:
    game_id = new_game(client)
    assert guess(client, game_id, as_player(1), 40).status_code == 200

    game = detail(client, game_id, 2)

    assert game["current_round"] == {
        "number": 1,
        "guesses": [
            {"player_id": 1, "guessed": True, "value": None},
            {"player_id": 2, "guessed": False, "value": None},
        ],
    }


def test_both_guesses_are_shown_once_both_have_guessed(client: TestClient) -> None:
    game_id = new_game(client)
    assert guess(client, game_id, as_player(1), 40).status_code == 200

    response = guess(client, game_id, as_player(2), 55)

    both = [
        {"player_id": 1, "guessed": True, "value": 40},
        {"player_id": 2, "guessed": True, "value": 55},
    ]
    assert response.json()["current_round"]["guesses"] == both
    assert detail(client, game_id, 1)["current_round"]["guesses"] == both


# Requirement: The creator enters the actual count after both guesses


def test_creator_settles_the_round(client: TestClient) -> None:
    game_id = new_game(client)
    assert guess(client, game_id, as_player(1), 40).status_code == 200
    assert guess(client, game_id, as_player(2), 55).status_code == 200

    response = actual(client, game_id, as_player(1), 47)

    assert response.status_code == 200
    assert [settled["actual"] for settled in response.json()["rounds"]] == [47]
    assert response.json()["current_round"]["number"] == 2


def test_opponent_cannot_enter_the_actual_count(client: TestClient) -> None:
    game_id = new_game(client)
    assert guess(client, game_id, as_player(1), 40).status_code == 200
    assert guess(client, game_id, as_player(2), 55).status_code == 200

    response = actual(client, game_id, as_player(2), 47)

    assert response.status_code == 403
    assert response.json() == {"detail": "Only the creator enters the actual count"}
    assert detail(client, game_id)["rounds"] == []


def test_actual_count_before_both_guesses(client: TestClient) -> None:
    game_id = new_game(client)
    assert guess(client, game_id, as_player(1), 40).status_code == 200

    response = actual(client, game_id, as_player(1), 47)

    assert response.status_code == 409
    assert response.json() == {"detail": "Waiting for guesses"}


def test_actual_count_out_of_range(client: TestClient) -> None:
    game_id = new_game(client)
    assert guess(client, game_id, as_player(1), 40).status_code == 200
    assert guess(client, game_id, as_player(2), 55).status_code == 200

    response = actual(client, game_id, as_player(1), 501)

    assert response.status_code == 422
    assert detail(client, game_id)["rounds"] == []


# Requirement: A finished game takes no more moves


def won_game(client: TestClient) -> int:
    game_id = new_game(client)
    for _ in range(5):
        play(client, game_id, 40, 60, 45)
    return game_id


def test_guess_after_the_end(client: TestClient) -> None:
    game_id = won_game(client)

    response = guess(client, game_id, as_player(2), 40)

    assert response.status_code == 409
    assert response.json() == {"detail": "Game is finished"}


def test_actual_count_after_the_end(client: TestClient) -> None:
    game_id = won_game(client)

    response = actual(client, game_id, as_player(1), 47)

    assert response.status_code == 409
    assert response.json() == {"detail": "Game is finished"}


# Requirement: Rounds survive a restart


def test_restart_in_the_middle_of_a_round(open_client: Callable[[], TestClient]) -> None:
    with open_client() as before:
        game_id = new_game(before)
        play(before, game_id, 40, 55, 47)
        assert guess(before, game_id, as_player(2), 30).status_code == 200

    with open_client() as after:
        game = detail(after, game_id, 2)

    assert [settled["actual"] for settled in game["rounds"]] == [47]
    assert game["current_round"]["guesses"] == [
        {"player_id": 1, "guessed": False, "value": None},
        {"player_id": 2, "guessed": True, "value": 30},
    ]


# scoring — Requirement: The first player to 5 points wins the game


def test_full_game_through_the_api(client: TestClient) -> None:
    game_id = new_game(client)
    for _ in range(4):
        play(client, game_id, 40, 60, 45)
    # "Four points is not the end", through the API: status is stored, not returned by settle.
    four = detail(client, game_id, 2)
    assert four["status"] == "active"
    assert four["winner_id"] is None
    assert four["final_penalty"] is None
    assert four["score"] == [{"player_id": 1, "points": 4}, {"player_id": 2, "points": 0}]
    play(client, game_id, 40, 60, 45)

    listed = client.get("/api/games", headers=as_player(2)).json()

    assert len(listed) == 1
    assert listed[0]["id"] == game_id
    assert listed[0]["status"] == "finished"
    assert listed[0]["winner_id"] == 1
    assert listed[0]["score"] == [{"player_id": 1, "points": 5}, {"player_id": 2, "points": 0}]
    game = detail(client, game_id, 2)
    assert game["current_round"] is None
    assert game["final_penalty"] == {"player_id": 2, "reps": 30, "doubled": False}
    # "Fifth point ends the game", through the API: streak penalties and none for the last round.
    assert [settled["penalty"] for settled in game["rounds"]] == [
        {"player_id": 2, "reps": 10, "doubled": False},
        {"player_id": 2, "reps": 15, "doubled": False},
        {"player_id": 2, "reps": 20, "doubled": False},
        {"player_id": 2, "reps": 25, "doubled": False},
        None,
    ]


def test_doubled_penalty_through_the_api(client: TestClient) -> None:
    # Not a spec scenario: guards that the API passes `doubled` on instead of a fixed false.
    game_id = new_game(client)
    play(client, game_id, 50, 47, 47)

    game = detail(client, game_id, 1)

    assert game["rounds"][0]["penalty"] == {"player_id": 1, "reps": 20, "doubled": True}


def test_exact_last_round_through_the_api(client: TestClient) -> None:
    # scoring "Exact guess in the last round doubles the final penalty", through the API.
    game_id = new_game(client)
    for _ in range(4):
        play(client, game_id, 45, 40, 46)
    play(client, game_id, 46, 40, 46)

    game = detail(client, game_id, 2)

    assert game["status"] == "finished"
    assert game["winner_id"] == 1
    assert game["rounds"][4]["penalty"] is None
    assert game["final_penalty"] == {"player_id": 2, "reps": 60, "doubled": True}
