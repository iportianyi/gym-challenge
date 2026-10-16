import hashlib
import hmac
import json
import time
from collections.abc import Callable, Iterator
from pathlib import Path
from typing import Any
from urllib.parse import urlencode

import httpx
import pytest
from fastapi.testclient import TestClient

from app.main import create_app

INDEX_HTML = '<!doctype html>\n<html lang="uk"><body><div id="root"></div></body></html>\n'

# The bot token the test server runs with (telegram-auth spec); not a real bot.
BOT_TOKEN = "123456:TEST-TOKEN"

# The bot username invite links name (invites spec); not a real bot.
BOT_USERNAME = "gym_test_bot"

# Test players by id: name and Telegram user id (telegram-auth spec, "As player N").
PLAYERS = {1: ("Клієнт", 1001), 2: ("Тренер", 1002), 3: ("Гість", 1003)}


def sign_fields(fields: dict[str, str], token: str = BOT_TOKEN) -> dict[str, str]:
    """Telegram's algorithm, written apart from app/auth.py: the fields plus their `hash`."""
    data_check_string = "\n".join(f"{key}={value}" for key, value in sorted(fields.items()))
    secret = hmac.new(b"WebAppData", token.encode(), hashlib.sha256).digest()
    signed = hmac.new(secret, data_check_string.encode(), hashlib.sha256).hexdigest()
    return {**fields, "hash": signed}


def sign_init_data(
    user_id: int | None,
    first_name: str = "Іван",
    *,
    age: int = 60,
    token: str = BOT_TOKEN,
    extra: dict[str, str] | None = None,
) -> str:
    """Raw `initData` as Telegram gives it to the Mini App, `age` seconds old."""
    fields = {"auth_date": str(int(time.time()) - age), **(extra or {})}
    if user_id is not None:
        fields["user"] = json.dumps({"id": user_id, "first_name": first_name}, ensure_ascii=False)
    return urlencode(sign_fields(fields, token))


def login(user_id: int, **kwargs: Any) -> dict[str, str]:
    """Headers with a valid login for Telegram user `user_id`."""
    return {"Authorization": f"tma {sign_init_data(user_id, **kwargs)}"}


def as_player(number: int) -> dict[str, str]:
    """Headers acting as test player `number` (1 Клієнт, 2 Тренер, 3 Гість)."""
    name, telegram_id = PLAYERS[number]
    return login(telegram_id, first_name=name)


def register(client: TestClient, *numbers: int) -> None:
    """Registers test players in this order; on an empty database they get ids 1, 2, 3."""
    for number in numbers:
        name, _ = PLAYERS[number]
        response = client.post("/api/me", headers=as_player(number), json={"name": name})
        assert response.status_code == 201, response.text
        assert response.json() == {"id": number, "name": name}


# The settings of the game in the scenarios: Присідання, base 10, step 5, final 30.
SETTINGS: dict[str, Any] = {
    "exercise": "Присідання",
    "base_reps": 10,
    "step_reps": 5,
    "final_reps": 30,
}


def invite(client: TestClient, organizer: int = 1, **changes: Any) -> tuple[int, str]:
    """An invite game of player `organizer` (invites spec): its id and the token of its link."""
    response = client.post("/api/games", headers=as_player(organizer), json={**SETTINGS, **changes})
    assert response.status_code == 201, response.text
    game_id = response.json()["id"]
    game = client.get(f"/api/games/{game_id}", headers=as_player(organizer)).json()
    return game_id, game["invite_url"].partition("startapp=")[2]


def join(client: TestClient, number: int, token: Any) -> httpx.Response:
    """Player `number` opens an invite link: `POST /api/games/join`."""
    return client.post("/api/games/join", headers=as_player(number), json={"token": token})


def share_game(client: TestClient, organizer: int = 1, opponent: int = 2, **changes: Any) -> int:
    """A game the two players share: `organizer` invites, `opponent` joins (design D9)."""
    game_id, token = invite(client, organizer, **changes)
    response = join(client, opponent, token)
    assert response.status_code == 200, response.text
    return game_id


@pytest.fixture
def frontend_dir(tmp_path: Path) -> Path:
    """A stand-in for the built frontend: index.html and one asset, no real build needed."""
    (tmp_path / "index.html").write_text(INDEX_HTML, encoding="utf-8")
    (tmp_path / "assets").mkdir()
    (tmp_path / "assets" / "app.js").write_text("console.log('app');\n", encoding="utf-8")
    return tmp_path


@pytest.fixture
def client(open_client: Callable[[], TestClient]) -> Iterator[TestClient]:
    with open_client() as test_client:
        yield test_client


@pytest.fixture
def database_url(tmp_path: Path) -> str:
    """A SQLite file per test; a second app on the same URL sees the same data (restarts)."""
    return f"sqlite:///{tmp_path / 'gym.db'}"


@pytest.fixture
def open_client(frontend_dir: Path, database_url: str) -> Callable[[], TestClient]:
    """A fresh app on the test database per call (a new start): `with open_client() as c:`."""

    def make() -> TestClient:
        return TestClient(
            create_app(
                frontend_dir=frontend_dir,
                database_url=database_url,
                bot_token=BOT_TOKEN,
                bot_username=BOT_USERNAME,
            )
        )

    return make


@pytest.fixture
def players(open_client: Callable[[], TestClient]) -> None:
    """Players 1 Клієнт and 2 Тренер, registered by Telegram login in a start of their own."""
    with open_client() as test_client:
        register(test_client, 1, 2)
