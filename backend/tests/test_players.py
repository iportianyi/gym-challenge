"""API scenarios from openspec/changes/add-game-setup/specs/players/spec.md."""

from collections.abc import Callable

from fastapi.testclient import TestClient

DEFAULT_PLAYERS = [
    {"id": 1, "name": "Клієнт", "email": "client@gym.local"},
    {"id": 2, "name": "Тренер", "email": "coach@gym.local"},
]
UNKNOWN_PLAYER = {"detail": "Unknown player"}


# Requirement: Two default players exist


def test_fresh_database(client: TestClient) -> None:
    response = client.get("/api/players")

    assert response.status_code == 200
    assert response.json() == DEFAULT_PLAYERS


def test_restart_keeps_two_players(open_client: Callable[[], TestClient]) -> None:
    with open_client() as first_start:
        assert first_start.get("/api/players").status_code == 200

    with open_client() as second_start:
        players = second_start.get("/api/players").json()

    assert len(players) == 2
    assert [player["id"] for player in players] == [1, 2]


# Requirement: Listing players needs no player identity


def test_no_identity_header(client: TestClient) -> None:
    response = client.get("/api/players")

    assert "x-player-id" not in response.request.headers
    assert response.status_code == 200


# Requirement: A request names its player in the X-Player-Id header


def test_header_missing(client: TestClient) -> None:
    response = client.get("/api/games")

    assert response.status_code == 401
    assert response.json() == UNKNOWN_PLAYER


def test_header_is_not_a_number(client: TestClient) -> None:
    response = client.get("/api/games", headers={"X-Player-Id": "abc"})

    assert response.status_code == 401
    assert response.json() == UNKNOWN_PLAYER


def test_no_player_with_that_id(client: TestClient) -> None:
    response = client.get("/api/games", headers={"X-Player-Id": "99"})

    assert response.status_code == 401
    assert response.json() == UNKNOWN_PLAYER


def test_known_player(client: TestClient) -> None:
    response = client.get("/api/games", headers={"X-Player-Id": "2"})

    assert response.status_code == 200
