"""API scenarios from openspec/changes/telegram-auth/specs/players/spec.md."""

import sqlite3
from collections.abc import Callable

from alembic import command
from fastapi.testclient import TestClient

from tests.conftest import as_player, login, register
from tests.test_migrations import migrate, sqlite_path

NOT_REGISTERED = {"detail": "Not registered"}

# Requirement: A Telegram user becomes a player by choosing a name


def test_first_login(client: TestClient) -> None:
    response = client.post("/api/me", headers=login(1001), json={"name": "  Іван "})

    assert response.status_code == 201
    assert response.json() == {"id": 1, "name": "Іван"}


def test_names_need_not_be_unique(client: TestClient) -> None:
    assert client.post("/api/me", headers=login(1001), json={"name": "Іван"}).status_code == 201

    response = client.post("/api/me", headers=login(1002), json={"name": "Іван"})

    assert response.status_code == 201
    assert response.json() == {"id": 2, "name": "Іван"}


# Requirement: The app asks the server who I am


def test_not_registered_yet(client: TestClient) -> None:
    response = client.get("/api/me", headers=login(1001))

    assert response.status_code == 404
    assert response.json() == NOT_REGISTERED


def test_registered(client: TestClient) -> None:
    assert client.post("/api/me", headers=login(1001), json={"name": "Іван"}).status_code == 201

    response = client.get("/api/me", headers=login(1001))

    assert response.status_code == 200
    assert response.json() == {"id": 1, "name": "Іван"}


# Requirement: A Telegram account belongs to one player


def test_registering_twice(client: TestClient) -> None:
    assert client.post("/api/me", headers=login(1001), json={"name": "Іван"}).status_code == 201

    response = client.post("/api/me", headers=login(1001), json={"name": "Петро"})

    assert response.status_code == 409
    assert response.json() == {"detail": "Already registered"}
    assert client.get("/api/me", headers=login(1001)).json() == {"id": 1, "name": "Іван"}


# Requirement: A player's name is 1 to 40 characters


def test_blank_name(client: TestClient) -> None:
    response = client.post("/api/me", headers=login(1001), json={"name": "   "})

    assert response.status_code == 422
    assert client.get("/api/me", headers=login(1001)).status_code == 404


def test_longest_name(client: TestClient) -> None:
    response = client.post("/api/me", headers=login(1001), json={"name": "я" * 40})

    assert response.status_code == 201


def test_name_too_long(client: TestClient) -> None:
    response = client.post("/api/me", headers=login(1001), json={"name": "я" * 41})

    assert response.status_code == 422


# Requirement: Only registered players can use the game endpoints


def test_unregistered_user_lists_games(client: TestClient) -> None:
    response = client.get("/api/games", headers=login(1009))

    assert response.status_code == 403
    assert response.json() == NOT_REGISTERED


def test_unregistered_user_lists_players(client: TestClient) -> None:
    response = client.get("/api/players", headers=login(1009))

    assert response.status_code == 403


# Requirement: Other players are listed for choosing an opponent


def test_three_players(client: TestClient) -> None:
    register(client, 1, 2, 3)

    response = client.get("/api/players", headers=as_player(1))

    assert response.status_code == 200
    assert response.json() == [{"id": 2, "name": "Тренер"}, {"id": 3, "name": "Гість"}]


def test_alone_in_the_app(client: TestClient) -> None:
    register(client, 1)

    response = client.get("/api/players", headers=as_player(1))

    assert response.json() == []


# Requirement: The default players and their games are gone


def test_upgrade_from_the_mvp_database(
    open_client: Callable[[], TestClient], database_url: str
) -> None:
    # 0001 inserts Клієнт and Тренер with their emails; add a game with one settled round.
    migrate(database_url, lambda config: command.upgrade(config, "0002"))
    with sqlite3.connect(sqlite_path(database_url)) as connection:
        connection.execute(
            "INSERT INTO game (creator_id, opponent_id, exercise, base_reps, step_reps, final_reps,"
            " status, created_at) VALUES (1, 2, 'Присідання', 10, 5, 30, 'active', '2026-10-03')"
        )
        connection.execute("INSERT INTO round (game_id, number, actual) VALUES (1, 1, 47)")
        connection.execute("INSERT INTO round (game_id, number) VALUES (1, 2)")
        connection.executemany(
            "INSERT INTO guess (round_id, player_id, value, created_at)"
            " VALUES (1, ?, ?, '2026-10-03')",
            [(1, 40), (2, 55)],
        )

    with open_client() as client:
        assert client.get("/api/me", headers=login(1001)).status_code == 404
        response = client.post("/api/me", headers=login(1001), json={"name": "Іван"})
        assert response.status_code == 201
        me = login(1001)
        assert client.get("/api/games", headers=me).json() == []
        assert client.get("/api/players", headers=me).json() == []


# Requirement: Players survive a restart


def test_restart(open_client: Callable[[], TestClient]) -> None:
    with open_client() as before:
        assert before.post("/api/me", headers=login(1001), json={"name": "Іван"}).status_code == 201

    with open_client() as after:
        response = after.get("/api/me", headers=login(1001))

    assert response.json() == {"id": 1, "name": "Іван"}
