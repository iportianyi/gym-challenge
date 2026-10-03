import os
from collections.abc import AsyncIterator, Callable
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import APIRouter, FastAPI, HTTPException, Request
from starlette.routing import Match

from app.api import games, health, players
from app.db import create_db_engine, database_url_from_env, run_migrations

API_METHODS = ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]


def api_fallback(api: APIRouter) -> Callable[[Request, str], None]:
    """Endpoint for the /api catch-all: 405 + Allow if the path exists for other methods, else 404.

    For each method we ask the routes of our own `api` router whether they would match the request
    fully (Starlette's public `BaseRoute.matches`). Asking per method, rather than reading
    `route.methods`, also covers included routers: since FastAPI 0.142 `include_router()` keeps an
    included router as one opaque route that has no `methods`.
    """

    def endpoint(request: Request, path: str) -> None:
        routes = [route for route in api.routes if getattr(route, "endpoint", None) is not endpoint]
        allowed = [
            method
            for method in API_METHODS
            if any(
                route.matches({**request.scope, "method": method})[0] == Match.FULL
                for route in routes
            )
        ]
        if allowed:
            raise HTTPException(
                status_code=405,
                detail="Method Not Allowed",
                headers={"Allow": ", ".join(allowed)},
            )
        raise HTTPException(status_code=404, detail="Not Found")

    return endpoint


def create_app(frontend_dir: Path | None = None, *, database_url: str) -> FastAPI:
    engine = create_db_engine(database_url)

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        # One process (`fastapi run`), so migrating at startup cannot race another worker.
        run_migrations(engine)
        yield
        engine.dispose()

    app = FastAPI(title="gym-challenge", lifespan=lifespan)
    app.state.engine = engine

    api = APIRouter(prefix="/api")
    api.include_router(health.router)
    api.include_router(players.router)
    api.include_router(games.router)
    # Must stay the LAST /api route: it answers 404 JSON for any unknown /api path and any method.
    # Without it, app.frontend() would serve index.html to a browser (Accept: text/html)
    # that asks for /api/<unknown>.
    # One function for all methods on purpose: one fallback behaviour (404, or 405 + Allow when the
    # path exists for other methods), not several operations.
    api.add_api_route(
        "/{path:path}", api_fallback(api), methods=API_METHODS, include_in_schema=False
    )
    app.include_router(api)

    if frontend_dir is not None:
        app.frontend("/", directory=frontend_dir)
    return app


def frontend_dir_from_env() -> Path | None:
    """FRONTEND_DIST unset -> API only (tests, local API work).

    Set -> serve that build; app.frontend() fails at startup if the directory is missing.
    """
    value = os.environ.get("FRONTEND_DIST")
    return Path(value) if value else None


app = create_app(frontend_dir_from_env(), database_url=database_url_from_env())
