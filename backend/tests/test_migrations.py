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


def test_0002_opens_round_1_for_games_created_before_it(database_url: str) -> None:
    migrate(database_url, lambda config: command.upgrade(config, "0001"))
    with sqlite3.connect(sqlite_path(database_url)) as connection:
        connection.execute(
            "INSERT INTO game (creator_id, opponent_id, exercise, base_reps, step_reps, final_reps,"
            " status, created_at) VALUES (1, 2, 'Присідання', 10, 5, 30, 'active', '2026-10-03')"
        )

    migrate(database_url, lambda config: command.upgrade(config, "0002"))

    with sqlite3.connect(sqlite_path(database_url)) as connection:
        rounds = connection.execute("SELECT game_id, number, actual FROM round").fetchall()
    assert rounds == [(1, 1, None)]


def test_downgrade_to_0001_and_upgrade_again(
    open_client: Callable[[], TestClient], database_url: str
) -> None:
    with open_client() as client:
        register(client, 1, 2)
        body = {"opponent_id": 2, "exercise": "Присідання", "base_reps": 10, "step_reps": 5}
        response = client.post("/api/games", headers=as_player(1), json={**body, "final_reps": 30})
        assert response.status_code == 201

    migrate(database_url, lambda config: command.downgrade(config, "0001"))
    migrate(database_url, lambda config: command.upgrade(config, "head"))

    # 0003 starts from an empty app again
    # (players spec, "The default players and their games are gone").
    with open_client() as client:
        assert client.get("/api/me", headers=as_player(1)).status_code == 404
