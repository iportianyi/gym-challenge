import os
from pathlib import Path

from fastapi import APIRouter, FastAPI, HTTPException

from app.api import health

API_METHODS = ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]


def api_not_found(path: str) -> None:
    raise HTTPException(status_code=404, detail="Not Found")


def create_app(frontend_dir: Path | None = None) -> FastAPI:
    app = FastAPI(title="gym-challenge")

    api = APIRouter(prefix="/api")
    api.include_router(health.router)
    # Must stay the LAST /api route: it answers 404 JSON for any unknown /api path and any method.
    # Without it, app.frontend() would serve index.html to a browser (Accept: text/html)
    # that asks for /api/<unknown>.
    # One function for all methods on purpose: it is one behavior (404), not several operations.
    api.add_api_route("/{path:path}", api_not_found, methods=API_METHODS, include_in_schema=False)
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


app = create_app(frontend_dir_from_env())
