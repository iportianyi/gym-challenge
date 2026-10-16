"""API scenarios from openspec/changes/game-invites/specs/invites/spec.md."""

import re
import sqlite3
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import event

from tests.conftest import SETTINGS, as_player, invite, join, register
from tests.test_migrations import sqlite_path

pytestmark = pytest.mark.usefixtures("players")

INVITE_URL = re.compile(r"^https://t\.me/gym_test_bot\?startapp=[A-Za-z0-9_-]{22}$")
WAITING_FOR_OPPONENT = {"detail": "Waiting for opponent"}


def game(client: TestClient, game_id: int, player: int) -> dict[str, Any]:
    response = client.get(f"/api/games/{game_id}", headers=as_player(player))
    assert response.status_code == 200
    return response.json()


# Requirement: A game without an opponent waits for one


def test_create_an_invite_game(client: TestClient) -> None:
    response = client.post("/api/games", headers=as_player(1), json=SETTINGS)

    assert response.status_code == 201
    assert response.json() == {
        "id": 1,
        "organizer": {"id": 1, "name": "Клієнт"},
        "opponent": None,
        "exercise": "Присідання",
        "base_reps": 10,
        "step_reps": 5,
        "final_reps": 30,
        "status": "waiting",
        "score": [],
        "winner_id": None,
    }


def test_explicit_null_opponent(client: TestClient) -> None:
    response = client.post(
        "/api/games", headers=as_player(1), json={**SETTINGS, "opponent_id": None}
    )

    assert response.status_code == 201
    assert response.json()["status"] == "waiting"


# Requirement: Only the organizer sees the invite link


def test_organizer_looks_at_the_waiting_game(client: TestClient) -> None:
    game_id, _ = invite(client)

    body = game(client, game_id, 1)

    invite_url = body.pop("invite_url")
    assert body == {
        "id": 1,
        "organizer": {"id": 1, "name": "Клієнт"},
        "opponent": None,
        "exercise": "Присідання",
        "base_reps": 10,
        "step_reps": 5,
        "final_reps": 30,
        "status": "waiting",
        "score": [],
        "winner_id": None,
        "final_penalty": None,
        "rounds": [],
        "current_round": None,
    }
    assert INVITE_URL.match(invite_url), invite_url


def test_two_invites_two_tokens(client: TestClient) -> None:
    first, _ = invite(client)
    second, _ = invite(client)

    assert game(client, first, 1)["invite_url"] != game(client, second, 1)["invite_url"]


def test_nobody_else_sees_a_waiting_game(client: TestClient) -> None:
    game_id, _ = invite(client)

    response = client.get(f"/api/games/{game_id}", headers=as_player(2))

    assert response.status_code == 404
    assert client.get("/api/games", headers=as_player(2)).json() == []


# Requirement: Nothing is played until the opponent joins


def test_guess_in_a_waiting_game(client: TestClient) -> None:
    game_id, _ = invite(client)

    response = client.post(
        f"/api/games/{game_id}/guesses", headers=as_player(1), json={"value": 40}
    )

    assert response.status_code == 409
    assert response.json() == WAITING_FOR_OPPONENT


def test_actual_count_in_a_waiting_game(client: TestClient) -> None:
    game_id, _ = invite(client)

    response = client.post(f"/api/games/{game_id}/actual", headers=as_player(1), json={"value": 47})

    assert response.status_code == 409
    assert response.json() == WAITING_FOR_OPPONENT


# Requirement: The first other player who opens the link joins the game


def test_coach_joins(client: TestClient) -> None:
    game_id, token = invite(client)

    response = join(client, 2, token)

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "active"
    assert body["opponent"] == {"id": 2, "name": "Тренер"}
    assert body["invite_url"] is None
    assert body["current_round"] == {
        "number": 1,
        "guesses": [
            {"player_id": 1, "guessed": False, "value": None},
            {"player_id": 2, "guessed": False, "value": None},
        ],
    }
    seen_by_organizer = game(client, game_id, 1)
    assert seen_by_organizer["status"] == "active"
    assert seen_by_organizer["score"] == [
        {"player_id": 1, "points": 0},
        {"player_id": 2, "points": 0},
    ]
    assert seen_by_organizer["invite_url"] is None


def test_play_after_joining(client: TestClient) -> None:
    game_id, token = invite(client)
    assert join(client, 2, token).status_code == 200

    moves = [
        client.post(f"/api/games/{game_id}/guesses", headers=as_player(1), json={"value": 40}),
        client.post(f"/api/games/{game_id}/guesses", headers=as_player(2), json={"value": 55}),
        client.post(f"/api/games/{game_id}/actual", headers=as_player(1), json={"value": 47}),
    ]

    assert [move.status_code for move in moves] == [200, 200, 200]
    assert moves[-1].json()["score"] == [
        {"player_id": 1, "points": 1},
        {"player_id": 2, "points": 0},
    ]


# Requirement: A link joins one opponent only


def test_someone_else_opens_a_used_link(client: TestClient) -> None:
    register(client, 3)
    game_id, token = invite(client)
    assert join(client, 2, token).status_code == 200

    response = join(client, 3, token)

    assert response.status_code == 409
    assert response.json() == {"detail": "Invite already used"}
    assert game(client, game_id, 1)["opponent"] == {"id": 2, "name": "Тренер"}


def test_the_opponent_opens_the_link_again(client: TestClient) -> None:
    _, token = invite(client)
    assert join(client, 2, token).status_code == 200

    response = join(client, 2, token)

    assert response.status_code == 200
    assert response.json()["id"] == 1
    assert response.json()["opponent"] == {"id": 2, "name": "Тренер"}


def test_the_organizer_opens_their_own_link(client: TestClient) -> None:
    _, token = invite(client)

    response = join(client, 1, token)

    assert response.status_code == 200
    assert response.json()["id"] == 1
    assert response.json()["status"] == "waiting"
    assert response.json()["opponent"] is None


def test_unknown_token(client: TestClient) -> None:
    response = join(client, 2, "nope")

    assert response.status_code == 404
    assert response.json() == {"detail": "Invite not found"}


def test_token_is_not_a_string(client: TestClient) -> None:
    response = join(client, 2, 5)

    assert response.status_code == 422


# Design D4: two players open the same link at once — exactly one becomes the opponent.


@pytest.mark.parametrize(("other", "status"), [(2, 409), (3, 200)])
def test_join_lost_to_a_request_in_between(
    client: TestClient, database_url: str, other: int, status: int
) -> None:
    """Player 3 joins; just before its UPDATE, `other` joins the same game on another connection.

    Player 2 got in first: player 3 gets 409. Player 3's own double tap got in first: 200.
    """
    register(client, 3)
    game_id, token = invite(client)
    engine = client.app.state.engine
    raced = False

    @event.listens_for(engine, "before_cursor_execute")
    def join_first(_conn: Any, _cursor: Any, statement: str, *_: Any) -> None:
        nonlocal raced
        if not raced and statement.startswith("UPDATE game SET opponent_id"):
            raced = True
            with sqlite3.connect(sqlite_path(database_url)) as connection:
                connection.execute(
                    "UPDATE game SET opponent_id = ?, status = 'active' WHERE id = ?",
                    (other, game_id),
                )
                connection.execute("INSERT INTO round (game_id, number) VALUES (?, 1)", (game_id,))

    try:
        response = join(client, 3, token)
    finally:
        event.remove(engine, "before_cursor_execute", join_first)

    assert raced
    assert response.status_code == status
    body = game(client, game_id, 1)
    assert body["opponent"]["id"] == other
    assert body["current_round"]["number"] == 1
    with sqlite3.connect(sqlite_path(database_url)) as connection:
        assert connection.execute("SELECT count(*) FROM round").fetchone() == (1,)
