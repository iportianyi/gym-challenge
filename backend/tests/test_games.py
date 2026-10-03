"""API scenarios from openspec/changes/add-game-setup/specs/games/spec.md."""

import sqlite3
from collections.abc import Callable
from typing import Any

from fastapi.testclient import TestClient

AS_CLIENT = {"X-Player-Id": "1"}
AS_COACH = {"X-Player-Id": "2"}

VALID_BODY: dict[str, Any] = {
    "opponent_email": "coach@gym.local",
    "exercise": "Присідання",
    "base_reps": 10,
    "step_reps": 5,
    "final_reps": 30,
}


def body(**changes: Any) -> dict[str, Any]:
    return {**VALID_BODY, **changes}


# Requirement: Creator starts a game by the opponent's email


def test_client_starts_a_game_against_coach(api: TestClient) -> None:
    response = api.post("/api/games", headers=AS_CLIENT, json=VALID_BODY)

    assert response.status_code == 201
    assert response.json() == {
        "id": 1,
        "creator": {"id": 1, "name": "Клієнт"},
        "opponent": {"id": 2, "name": "Тренер"},
        "exercise": "Присідання",
        "base_reps": 10,
        "step_reps": 5,
        "final_reps": 30,
        "status": "active",
    }


def test_email_with_spaces_and_capitals(api: TestClient) -> None:
    response = api.post(
        "/api/games", headers=AS_COACH, json=body(opponent_email="  Client@GYM.local ")
    )

    assert response.status_code == 201
    assert response.json()["opponent"] == {"id": 1, "name": "Клієнт"}
    assert response.json()["creator"] == {"id": 2, "name": "Тренер"}


# Requirement: The opponent must be another existing player


def test_unknown_email(api: TestClient) -> None:
    response = api.post(
        "/api/games", headers=AS_CLIENT, json=body(opponent_email="nobody@gym.local")
    )

    assert response.status_code == 422
    assert response.json() == {"detail": "Opponent not found"}
    assert api.get("/api/games", headers=AS_CLIENT).json() == []


def test_own_email(api: TestClient) -> None:
    response = api.post(
        "/api/games", headers=AS_CLIENT, json=body(opponent_email="client@gym.local")
    )

    assert response.status_code == 422
    assert response.json() == {"detail": "Cannot play against yourself"}


# Requirement: Game settings are validated


def test_exercise_is_blank(api: TestClient) -> None:
    response = api.post("/api/games", headers=AS_CLIENT, json=body(exercise="   "))

    assert response.status_code == 422


def test_base_reps_is_zero(api: TestClient) -> None:
    response = api.post("/api/games", headers=AS_CLIENT, json=body(base_reps=0))

    assert response.status_code == 422


def test_step_may_be_zero(api: TestClient) -> None:
    response = api.post("/api/games", headers=AS_CLIENT, json=body(step_reps=0))

    assert response.status_code == 201
    assert response.json()["step_reps"] == 0


def test_final_reps_above_the_limit(api: TestClient) -> None:
    response = api.post("/api/games", headers=AS_CLIENT, json=body(final_reps=1001))

    assert response.status_code == 422


def test_exercise_is_trimmed(api: TestClient) -> None:
    response = api.post("/api/games", headers=AS_CLIENT, json=body(exercise="  Планка  "))

    assert response.status_code == 201
    assert response.json()["exercise"] == "Планка"


def test_game_endpoints_require_a_player(api: TestClient) -> None:
    response = api.post("/api/games", json=VALID_BODY)

    assert response.status_code == 401


# Requirement: Several active games are allowed


def test_second_game_with_the_same_opponent(api: TestClient) -> None:
    first = api.post("/api/games", headers=AS_CLIENT, json=VALID_BODY)
    second = api.post("/api/games", headers=AS_CLIENT, json=VALID_BODY)

    assert first.status_code == 201
    assert second.status_code == 201
    assert first.json()["id"] != second.json()["id"]


# Requirement: A player lists their own games, newest first


def test_opponent_sees_the_game(api: TestClient) -> None:
    for _ in range(2):
        assert api.post("/api/games", headers=AS_CLIENT, json=VALID_BODY).status_code == 201

    response = api.get("/api/games", headers=AS_COACH)

    assert response.status_code == 200
    assert [game["id"] for game in response.json()] == [2, 1]


def test_other_players_games_are_not_listed(api: TestClient, database_url: str) -> None:
    # The app has started, so the schema exists; the third player goes in with plain sqlite3.
    with sqlite3.connect(database_url.removeprefix("sqlite:///")) as connection:
        cursor = connection.execute(
            "INSERT INTO player (name, email) VALUES (?, ?)", ("Гість", "guest@gym.local")
        )
        guest_id = cursor.lastrowid
    assert api.post("/api/games", headers=AS_CLIENT, json=VALID_BODY).status_code == 201

    response = api.get("/api/games", headers={"X-Player-Id": str(guest_id)})

    assert response.status_code == 200
    assert response.json() == []


# Requirement: Games survive a restart


def test_restart(open_client: Callable[[], TestClient]) -> None:
    with open_client() as before:
        assert before.post("/api/games", headers=AS_CLIENT, json=VALID_BODY).status_code == 201

    with open_client() as after:
        games = after.get("/api/games", headers=AS_CLIENT).json()

    assert len(games) == 1
    assert games[0]["exercise"] == "Присідання"
