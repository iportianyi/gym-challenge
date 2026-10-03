from collections.abc import Callable, Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import create_app

INDEX_HTML = '<!doctype html>\n<html lang="uk"><body><div id="root"></div></body></html>\n'


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
        return TestClient(create_app(frontend_dir=frontend_dir, database_url=database_url))

    return make
