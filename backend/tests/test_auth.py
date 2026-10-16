"""API scenarios from openspec/changes/telegram-auth/specs/telegram-auth/spec.md."""

from pathlib import Path
from urllib.parse import parse_qsl, urlencode

import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from tests.conftest import login, sign_fields, sign_init_data

INVALID_LOGIN = {"detail": "Invalid Telegram login"}


def tma(init_data: str) -> dict[str, str]:
    return {"Authorization": f"tma {init_data}"}


# Requirement: A request proves its person with signed Telegram initData


def test_valid_login(client: TestClient) -> None:
    # A valid login of a user with no player yet: the login is accepted, the player is not found.
    assert client.post("/api/me", headers=login(1001), json={"name": "Іван"}).status_code == 201

    response = client.get("/api/me", headers=login(1001))

    assert response.status_code == 200


def test_no_authorization_header(client: TestClient) -> None:
    response = client.get("/api/games")

    assert response.status_code == 401
    assert response.json() == INVALID_LOGIN


def test_other_scheme(client: TestClient) -> None:
    response = client.get("/api/me", headers={"Authorization": f"Bearer {sign_init_data(1001)}"})

    assert response.status_code == 401
    assert response.json() == INVALID_LOGIN


def test_signed_with_another_bots_token(client: TestClient) -> None:
    response = client.get("/api/me", headers=tma(sign_init_data(1001, token="654321:OTHER-TOKEN")))

    assert response.status_code == 401


def test_user_changed_after_signing(client: TestClient) -> None:
    fields = dict(parse_qsl(sign_init_data(1001)))
    fields["user"] = '{"id": 1002, "first_name": "Іван"}'

    response = client.get("/api/me", headers=tma(urlencode(fields)))

    assert response.status_code == 401


def test_the_signature_field_is_part_of_the_checked_data(client: TestClient) -> None:
    assert client.post("/api/me", headers=login(1001), json={"name": "Іван"}).status_code == 201

    response = client.get("/api/me", headers=tma(sign_init_data(1001, extra={"signature": "abc"})))

    assert response.status_code == 200


def test_login_without_a_user(client: TestClient) -> None:
    response = client.get("/api/me", headers=tma(sign_init_data(None)))

    assert response.status_code == 401


def test_signature_field_removed_after_signing(client: TestClient) -> None:
    # Not a spec scenario: the converse of the one above — `signature` is checked, not skipped.
    fields = dict(parse_qsl(sign_init_data(1001, extra={"signature": "abc"})))
    del fields["signature"]

    response = client.get("/api/me", headers=tma(urlencode(fields)))

    assert response.status_code == 401


# Requirement: A login is accepted for 24 hours


def test_a_login_from_this_morning(client: TestClient) -> None:
    assert client.post("/api/me", headers=login(1001), json={"name": "Іван"}).status_code == 201

    response = client.get("/api/me", headers=login(1001, age=86000))

    assert response.status_code == 200


def test_a_login_from_yesterday(client: TestClient) -> None:
    response = client.get("/api/me", headers=login(1001, age=86401))

    assert response.status_code == 401
    assert response.json() == INVALID_LOGIN


def test_auth_date_is_not_a_number(client: TestClient) -> None:
    # Not a spec scenario: the requirement's "or one without a whole-number auth_date".
    signed = sign_fields({"auth_date": "soon", "user": '{"id": 1001, "first_name": "Іван"}'})

    response = client.get("/api/me", headers=tma(urlencode(signed)))

    assert response.status_code == 401


# Requirement: The server needs a bot token to start


@pytest.mark.parametrize("token", [None, ""])
def test_token_missing(frontend_dir: Path, database_url: str, token: str | None) -> None:
    app = create_app(frontend_dir=frontend_dir, database_url=database_url, bot_token=token)

    with pytest.raises(RuntimeError, match="TELEGRAM_BOT_TOKEN"), TestClient(app):
        pass


def test_health_check_does_not_need_a_login(client: TestClient) -> None:
    response = client.get("/api/health")

    assert response.status_code == 200
