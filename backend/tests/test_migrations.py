"""Migrations on data from earlier releases.

Moved from test_rounds.py by telegram-auth: since 0003 deletes the MVP games, migration 0002 is
checked at its own revision instead of through the API.
"""

import sqlite3
from collections.abc import Callable

from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient

from app.db import create_db_engine
from app.db import migrate as run_alembic
from tests.conftest import SETTINGS, as_player, register, share_game


def migrate(database_url: str, step: Callable[[Config], None]) -> None:
    """An Alembic command on the database file, the way the app runs migrations (app.db.migrate)."""
    engine = create_db_engine(database_url)
    try:
        run_alembic(engine, step)
    finally:
        engine.dispose()


def sqlite_path(database_url: str) -> str:
    return database_url.removeprefix("sqlite:///")


GAME_ROW = (
    "INSERT INTO game (creator_id, opponent_id, exercise, base_reps, step_reps, final_reps,"
    " status, created_at) VALUES (1, 2, 'Присідання', 10, 5, 30, 'active', '2026-10-03')"
)
GUESS_ROW = (
    "INSERT INTO guess (round_id, player_id, value, created_at) VALUES (?, ?, ?, '2026-10-03')"
)


def rounds_and_guesses(database_url: str) -> tuple[list, list]:
    with sqlite3.connect(sqlite_path(database_url)) as connection:
        rounds = connection.execute("SELECT id, game_id, number, actual FROM round").fetchall()
        guesses = connection.execute("SELECT round_id, player_id, value FROM guess").fetchall()
    return rounds, guesses


def test_game_created_before_0002_is_playable(database_url: str) -> None:
    migrate(database_url, lambda config: command.upgrade(config, "0001"))
    with sqlite3.connect(sqlite_path(database_url)) as connection:
        connection.execute(GAME_ROW)

    migrate(database_url, lambda config: command.upgrade(config, "0002"))

    # Playable at 0002: the game has its open round 1, and a guess can be recorded in it.
    rounds, _ = rounds_and_guesses(database_url)
    assert [(game_id, number, actual) for _, game_id, number, actual in rounds] == [(1, 1, None)]
    with sqlite3.connect(sqlite_path(database_url)) as connection:
        connection.execute(GUESS_ROW, (rounds[0][0], 1, 40))
    assert rounds_and_guesses(database_url)[1] == [(rounds[0][0], 1, 40)]


def test_0002_downgrades_and_upgrades_again(database_url: str) -> None:
    # A game with a settled round 1 and a guess in round 2, at revision 0002.
    migrate(database_url, lambda config: command.upgrade(config, "0002"))
    with sqlite3.connect(sqlite_path(database_url)) as connection:
        connection.execute(GAME_ROW)
        connection.execute("INSERT INTO round (game_id, number, actual) VALUES (1, 1, 47)")
        connection.execute("INSERT INTO round (game_id, number) VALUES (1, 2)")
        connection.executemany(GUESS_ROW, [(1, 1, 40), (1, 2, 55), (2, 2, 30)])

    migrate(database_url, lambda config: command.downgrade(config, "0001"))
    migrate(database_url, lambda config: command.upgrade(config, "0002"))

    # As before telegram-auth: no settled rounds, the current round is round 1 again, no guesses.
    rounds, guesses = rounds_and_guesses(database_url)
    assert [(game_id, number, actual) for _, game_id, number, actual in rounds] == [(1, 1, None)]
    assert guesses == []


def test_0003_downgrades_and_upgrades_again(
    open_client: Callable[[], TestClient], database_url: str
) -> None:
    with open_client() as client:
        register(client, 1, 2)
        share_game(client)

    migrate(database_url, lambda config: command.downgrade(config, "0002"))
    migrate(database_url, lambda config: command.upgrade(config, "head"))

    # 0003 starts from an empty app again
    # (players spec, "The default players and their games are gone").
    with open_client() as client:
        assert client.get("/api/me", headers=as_player(1)).status_code == 404


def game_columns(database_url: str) -> list[str]:
    with sqlite3.connect(sqlite_path(database_url)) as connection:
        return [row[1] for row in connection.execute("PRAGMA table_info(game)")]


def test_0004_renames_creator_to_organizer_and_keeps_games(database_url: str) -> None:
    # rename-creator-to-organizer, design D1: a game and its round survive the rename both ways.
    migrate(database_url, lambda config: command.upgrade(config, "0003"))
    with sqlite3.connect(sqlite_path(database_url)) as connection:
        connection.executemany(
            "INSERT INTO player (id, name) VALUES (?, ?)", [(1, "Іван"), (2, "Олег")]
        )
        connection.execute(GAME_ROW)
        connection.execute("INSERT INTO round (game_id, number, actual) VALUES (1, 1, 47)")

    migrate(database_url, lambda config: command.upgrade(config, "0004"))

    assert "organizer_id" in game_columns(database_url)
    assert "creator_id" not in game_columns(database_url)
    with sqlite3.connect(sqlite_path(database_url)) as connection:
        games = connection.execute("SELECT id, organizer_id, opponent_id FROM game").fetchall()
    assert games == [(1, 1, 2)]
    assert [
        (game_id, number, actual)
        for _, game_id, number, actual in rounds_and_guesses(database_url)[0]
    ] == [(1, 1, 47)]

    migrate(database_url, lambda config: command.downgrade(config, "0003"))

    assert "creator_id" in game_columns(database_url)
    with sqlite3.connect(sqlite_path(database_url)) as connection:
        assert connection.execute("SELECT id, creator_id FROM game").fetchall() == [(1, 1)]


def test_games_from_before_invitations_keep_their_opponent(
    open_client: Callable[[], TestClient], database_url: str
) -> None:
    # invites spec, "Upgrade with a game in progress": a game at 0004 is unchanged by 0005.
    migrate(database_url, lambda config: command.upgrade(config, "0004"))
    with sqlite3.connect(sqlite_path(database_url)) as connection:
        connection.executemany(
            "INSERT INTO player (id, name) VALUES (?, ?)", [(1, "Клієнт"), (2, "Тренер")]
        )
        connection.executemany(
            "INSERT INTO telegram_account (telegram_user_id, player_id, created_at)"
            " VALUES (?, ?, '2026-10-16')",
            [(1001, 1), (1002, 2)],
        )
        connection.execute(
            "INSERT INTO game (organizer_id, opponent_id, exercise, base_reps, step_reps,"
            " final_reps, status, created_at)"
            " VALUES (1, 2, 'Присідання', 10, 5, 30, 'active', '2026-10-16')"
        )
        connection.execute("INSERT INTO round (game_id, number, actual) VALUES (1, 1, 47)")
        connection.execute("INSERT INTO round (game_id, number) VALUES (1, 2)")
        connection.executemany(
            "INSERT INTO guess (round_id, player_id, value, created_at)"
            " VALUES (1, ?, ?, '2026-10-16')",
            [(1, 40), (2, 55)],
        )

    with open_client() as client:
        response = client.get("/api/games/1", headers=as_player(2))

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "active"
    assert body["opponent"] == {"id": 2, "name": "Тренер"}
    assert len(body["rounds"]) == 1
    assert body["invite_url"] is None


def test_0005_downgrades_and_upgrades_again(
    open_client: Callable[[], TestClient], database_url: str
) -> None:
    # game-invites, design D1: a shared game with a settled round survives both ways; a waiting
    # game is deleted by the downgrade (it has no opponent).
    with open_client() as client:
        register(client, 1, 2)
        game_id = share_game(client)
        for player, value in ((1, 40), (2, 55)):
            response = client.post(
                f"/api/games/{game_id}/guesses", headers=as_player(player), json={"value": value}
            )
            assert response.status_code == 200
        response = client.post(
            f"/api/games/{game_id}/actual", headers=as_player(1), json={"value": 47}
        )
        assert response.status_code == 200
        assert client.post("/api/games", headers=as_player(1), json=SETTINGS).status_code == 201

    migrate(database_url, lambda config: command.downgrade(config, "0004"))

    assert "invite_token" not in game_columns(database_url)
    with sqlite3.connect(sqlite_path(database_url)) as connection:
        assert connection.execute("SELECT id, opponent_id FROM game").fetchall() == [(1, 2)]
        assert connection.execute("PRAGMA foreign_key_check").fetchall() == []

    migrate(database_url, lambda config: command.upgrade(config, "head"))

    with open_client() as client:
        game = client.get(f"/api/games/{game_id}", headers=as_player(2)).json()
    assert [settled["actual"] for settled in game["rounds"]] == [47]
    with sqlite3.connect(sqlite_path(database_url)) as connection:
        assert connection.execute("PRAGMA foreign_key_check").fetchall() == []
