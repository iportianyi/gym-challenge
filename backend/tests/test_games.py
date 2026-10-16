"""API scenarios from openspec/specs/games/spec.md, as changed by the game-invites games delta.

A game between players who never played together starts by an invite (`share_game`); only a
known opponent can be named by `opponent_id`.
"""

from collections.abc import Callable
from typing import Any

import pytest
from fastapi.testclient import TestClient

from tests.conftest import SETTINGS, as_player, invite, register, share_game

pytestmark = pytest.mark.usefixtures("players")

VALID_BODY: dict[str, Any] = {"opponent_id": 2, **SETTINGS}


def body(**changes: Any) -> dict[str, Any]:
    return {**VALID_BODY, **changes}


@pytest.fixture
def known(players: None, client: TestClient) -> None:
    """Player 1 and player 2 share game 1 (after `players` has registered them)."""
    share_game(client)


# Requirement: Organizer starts a game against a chosen player


@pytest.mark.usefixtures("known")
def test_client_starts_a_game_against_coach(client: TestClient) -> None:
    response = client.post("/api/games", headers=as_player(1), json=VALID_BODY)

    assert response.status_code == 201
    assert response.json() == {
        "id": 2,
        "organizer": {"id": 1, "name": "Клієнт"},
        "opponent": {"id": 2, "name": "Тренер"},
        "exercise": "Присідання",
        "base_reps": 10,
        "step_reps": 5,
        "final_reps": 30,
        "status": "active",
        "score": [{"player_id": 1, "points": 0}, {"player_id": 2, "points": 0}],
        "winner_id": None,
    }


@pytest.mark.usefixtures("known")
def test_coach_starts_a_game_against_client(client: TestClient) -> None:
    response = client.post("/api/games", headers=as_player(2), json=body(opponent_id=1))

    assert response.status_code == 201
    assert response.json()["organizer"] == {"id": 2, "name": "Тренер"}
    assert response.json()["opponent"] == {"id": 1, "name": "Клієнт"}


# Requirement: The opponent must be a known opponent


def test_unknown_opponent(client: TestClient) -> None:
    response = client.post("/api/games", headers=as_player(1), json=body(opponent_id=99))

    assert response.status_code == 422
    assert response.json() == {"detail": "Opponent not found"}
    assert client.get("/api/games", headers=as_player(1)).json() == []


def test_a_player_never_played_with(client: TestClient) -> None:
    response = client.post("/api/games", headers=as_player(1), json=VALID_BODY)

    assert response.status_code == 422
    assert response.json() == {"detail": "Opponent not found"}
    assert client.get("/api/games", headers=as_player(1)).json() == []


def test_own_id(client: TestClient) -> None:
    response = client.post("/api/games", headers=as_player(1), json=body(opponent_id=1))

    assert response.status_code == 422
    assert response.json() == {"detail": "Cannot play against yourself"}


# Requirement: A player lists their known opponents


def test_most_recent_first(client: TestClient) -> None:
    register(client, 3)
    share_game(client, 1, 2)
    share_game(client, 1, 3)

    response = client.get("/api/opponents", headers=as_player(1))

    assert response.status_code == 200
    assert response.json() == [{"id": 3, "name": "Гість"}, {"id": 2, "name": "Тренер"}]


@pytest.mark.usefixtures("known")
def test_the_opponent_knows_the_organizer_too(client: TestClient) -> None:
    response = client.get("/api/opponents", headers=as_player(2))

    assert response.json() == [{"id": 1, "name": "Клієнт"}]


def test_other_players_are_not_known_opponents(client: TestClient) -> None:
    register(client, 3)
    share_game(client)

    response = client.get("/api/opponents", headers=as_player(3))

    assert response.json() == []


def test_a_waiting_game_does_not_count(client: TestClient) -> None:
    invite(client)

    response = client.get("/api/opponents", headers=as_player(1))

    assert response.json() == []


# Requirement: Game settings are validated


@pytest.mark.usefixtures("known")
def test_exercise_is_blank(client: TestClient) -> None:
    response = client.post("/api/games", headers=as_player(1), json=body(exercise="   "))

    assert response.status_code == 422


@pytest.mark.usefixtures("known")
def test_base_reps_is_zero(client: TestClient) -> None:
    response = client.post("/api/games", headers=as_player(1), json=body(base_reps=0))

    assert response.status_code == 422


@pytest.mark.usefixtures("known")
def test_step_may_be_zero(client: TestClient) -> None:
    response = client.post("/api/games", headers=as_player(1), json=body(step_reps=0))

    assert response.status_code == 201
    assert response.json()["step_reps"] == 0


@pytest.mark.usefixtures("known")
def test_final_reps_above_the_limit(client: TestClient) -> None:
    response = client.post("/api/games", headers=as_player(1), json=body(final_reps=1001))

    assert response.status_code == 422


@pytest.mark.usefixtures("known")
def test_exercise_is_trimmed(client: TestClient) -> None:
    response = client.post("/api/games", headers=as_player(1), json=body(exercise="  Планка  "))

    assert response.status_code == 201
    assert response.json()["exercise"] == "Планка"


def test_an_invite_game_is_validated_too(client: TestClient) -> None:
    response = client.post("/api/games", headers=as_player(1), json={**SETTINGS, "base_reps": 0})

    assert response.status_code == 422
    assert client.get("/api/games", headers=as_player(1)).json() == []


def test_game_endpoints_require_a_player(client: TestClient) -> None:
    response = client.post("/api/games", json=VALID_BODY)

    assert response.status_code == 401
    assert response.json() == {"detail": "Invalid Telegram login"}


# Requirement: Several active games are allowed


@pytest.mark.usefixtures("known")
def test_second_game_with_the_same_opponent(client: TestClient) -> None:
    first = client.post("/api/games", headers=as_player(1), json=VALID_BODY)
    second = client.post("/api/games", headers=as_player(1), json=VALID_BODY)

    assert first.status_code == 201
    assert second.status_code == 201
    assert first.json()["id"] != second.json()["id"]


# Requirement: A player lists their own games, newest first


def test_opponent_sees_the_game(client: TestClient) -> None:
    share_game(client)
    share_game(client)

    response = client.get("/api/games", headers=as_player(2))

    assert response.status_code == 200
    assert [game["id"] for game in response.json()] == [2, 1]


def test_other_players_games_are_not_listed(client: TestClient) -> None:
    register(client, 3)
    share_game(client)

    response = client.get("/api/games", headers=as_player(3))

    assert response.status_code == 200
    assert response.json() == []


# Requirement: Listed games show their current score


def test_score_after_one_round(client: TestClient) -> None:
    game_id = share_game(client)
    for headers, value in ((as_player(1), 40), (as_player(2), 55)):
        response = client.post(
            f"/api/games/{game_id}/guesses", headers=headers, json={"value": value}
        )
        assert response.status_code == 200
    response = client.post(f"/api/games/{game_id}/actual", headers=as_player(1), json={"value": 47})
    assert response.status_code == 200

    listed = client.get("/api/games", headers=as_player(2)).json()

    assert listed[0]["score"] == [{"player_id": 1, "points": 1}, {"player_id": 2, "points": 0}]
    assert listed[0]["winner_id"] is None


def test_waiting_game_in_the_list(client: TestClient) -> None:
    invite(client)

    [listed] = client.get("/api/games", headers=as_player(1)).json()

    assert listed["status"] == "waiting"
    assert listed["opponent"] is None
    assert listed["score"] == []


# Requirement: Games survive a restart


def test_restart(open_client: Callable[[], TestClient]) -> None:
    with open_client() as before:
        share_game(before)

    with open_client() as after:
        games = after.get("/api/games", headers=as_player(1)).json()

    assert len(games) == 1
    assert games[0]["exercise"] == "Присідання"
