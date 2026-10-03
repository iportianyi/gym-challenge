import os
from collections.abc import Iterator
from pathlib import Path
from typing import Annotated, Any

from alembic import command
from alembic.config import Config
from fastapi import Depends, Request
from sqlalchemy import Engine, event
from sqlmodel import Session, create_engine

MIGRATIONS_DIR = Path(__file__).parent / "migrations"


def database_url_from_env() -> str:
    """DATABASE_URL unset -> ./gym.db next to the working directory (git-ignored)."""
    return os.environ.get("DATABASE_URL", "sqlite:///./gym.db")


def create_db_engine(database_url: str) -> Engine:
    # FastAPI runs sync endpoints in a thread pool: a SQLite connection may change threads.
    engine = create_engine(database_url, connect_args={"check_same_thread": False})

    @event.listens_for(engine, "connect")
    def enable_foreign_keys(dbapi_connection: Any, _record: Any) -> None:
        # SQLite ignores FOREIGN KEY constraints unless this is set on every connection.
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    return engine


def run_migrations(engine: Engine) -> None:
    """`alembic upgrade head` on the app's own engine."""
    config = Config()
    config.set_main_option("script_location", str(MIGRATIONS_DIR))
    with engine.begin() as connection:
        config.attributes["connection"] = connection
        command.upgrade(config, "head")


def get_session(request: Request) -> Iterator[Session]:
    with Session(request.app.state.engine) as session:
        yield session


SessionDep = Annotated[Session, Depends(get_session)]
