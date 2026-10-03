"""Alembic environment. The app runs migrations on its own connection (app.db.run_migrations);
without one (a script calling alembic.command directly) it connects to DATABASE_URL."""

from alembic import context
from sqlalchemy import Connection
from sqlmodel import SQLModel

from app import models  # noqa: F401  (registers the tables on SQLModel.metadata)
from app.db import create_db_engine, database_url_from_env

target_metadata = SQLModel.metadata


def run(connection: Connection) -> None:
    # render_as_batch: SQLite cannot ALTER most things in place; batch mode rebuilds the table.
    context.configure(connection=connection, target_metadata=target_metadata, render_as_batch=True)
    with context.begin_transaction():
        context.run_migrations()


connection = context.config.attributes.get("connection")
if connection is not None:
    run(connection)
else:
    with create_db_engine(database_url_from_env()).connect() as own_connection:
        run(own_connection)
        own_connection.commit()
