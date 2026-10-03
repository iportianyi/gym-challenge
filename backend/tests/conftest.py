from collections.abc import Iterator
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
def client(frontend_dir: Path) -> Iterator[TestClient]:
    with TestClient(create_app(frontend_dir=frontend_dir)) as test_client:
        yield test_client
