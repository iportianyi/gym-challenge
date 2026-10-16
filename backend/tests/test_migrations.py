"""Migrations on data from earlier releases.

Moved from test_rounds.py by telegram-auth: since 0003 deletes the MVP games, migration 0002 is
checked at its own revision instead of through the API.
"""

import sqlite3
from collections.abc import Callable

from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient

from app.db import MIGRATIONS_DIR, create_db_engine
from tests.conftest import as_player, register


def alembic_config() -> Config:
    config = Config()
    config.set_main_option("script_location", str(MIGRATIONS_DIR))
    return config


def migrate(database_url: str, step: Callable[[Config], None]) -> None:
    engine = create_db_engine(database_url)
    try:
        with engine.begin() as connection:
            config = alembic_config()
            config.attributes["connection"] = connection
            step(config)
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
        body = {"opponent_id": 2, "exercise": "Присідання", "base_reps": 10, "step_reps": 5}
        response = client.post("/api/games", headers=as_player(1), json={**body, "final_reps": 30})
        assert response.status_code == 201

    migrate(database_url, lambda config: command.downgrade(config, "0002"))
    migrate(database_url, lambda config: command.upgrade(config, "head"))

    # 0003 starts from an empty app again
    # (players spec, "The default players and their games are gone").
    with open_client() as client:
        assert client.get("/api/me", headers=as_player(1)).status_code == 404
