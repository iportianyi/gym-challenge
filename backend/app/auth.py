"""Who makes a request: Telegram Mini App `initData`, checked with the bot token.

See openspec telegram-auth, design D1–D3.
"""

import hashlib
import hmac
import json
import time
from dataclasses import dataclass
from typing import Annotated
from urllib.parse import parse_qsl

from fastapi import Depends, Header, HTTPException, Request

from app.db import SessionDep
from app.models import Player, TelegramAccount

# Telegram issues fresh initData each time the Mini App is opened; one day covers a gym visit
# (decision 3).
MAX_AGE_SECONDS = 86400


@dataclass(frozen=True)
class TelegramUser:
    id: int
    first_name: str


def verify_init_data(raw: str, bot_token: str, now: float) -> TelegramUser | None:
    """The Telegram user of `raw` initData if Telegram signed it for this bot recently, else None.

    Telegram's check: `hash` is the hex HMAC-SHA-256 of the data-check-string — every other field
    as key=value, sorted by key, joined by newlines (`signature` included) — keyed with
    HMAC-SHA-256("WebAppData", bot token). "Recently" is MAX_AGE_SECONDS after `auth_date`.
    """
    try:
        pairs = parse_qsl(raw, keep_blank_values=True, strict_parsing=True)
    except ValueError:
        return None
    fields = dict(pairs)
    if len(fields) != len(pairs):  # a repeated key: which value was signed is ambiguous
        return None
    received = fields.pop("hash", None)
    if received is None:
        return None
    data_check_string = "\n".join(f"{key}={value}" for key, value in sorted(fields.items()))
    secret = hmac.new(b"WebAppData", bot_token.encode(), hashlib.sha256).digest()
    expected = hmac.new(secret, data_check_string.encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, received):
        return None

    auth_date = fields.get("auth_date", "")
    if (
        not (auth_date.isascii() and auth_date.isdecimal())
        or now - int(auth_date) > MAX_AGE_SECONDS
    ):
        return None
    try:
        user = json.loads(fields.get("user", ""))
    except ValueError:
        return None
    if not isinstance(user, dict) or type(user.get("id")) is not int:
        return None
    return TelegramUser(id=user["id"], first_name=str(user.get("first_name", "")))


def telegram_user(
    request: Request, authorization: Annotated[str | None, Header()] = None
) -> TelegramUser:
    """The verified Telegram user of `Authorization: tma <initData>`; any failure is the same 401.

    Read as a string so a malformed header is a 401, not a 422.
    """
    scheme, _, raw = (authorization or "").partition(" ")
    user = None
    if scheme == "tma" and raw:
        user = verify_init_data(raw, request.app.state.bot_token, time.time())
    if user is None:
        raise HTTPException(status_code=401, detail="Invalid Telegram login")
    return user


TelegramUserDep = Annotated[TelegramUser, Depends(telegram_user)]


def current_player(session: SessionDep, user: TelegramUserDep) -> Player:
    """The player linked to the request's Telegram user; 403 until they have chosen a name."""
    account = session.get(TelegramAccount, user.id)
    player = session.get(Player, account.player_id) if account is not None else None
    if player is None:
        raise HTTPException(status_code=403, detail="Not registered")
    return player


CurrentPlayerDep = Annotated[Player, Depends(current_player)]
