"""Server-side scenarios from openspec/changes/add-project-skeleton/specs/web-shell/spec.md.

The content of index.html (lang="uk", viewport meta) is checked in frontend/src/indexHtml.test.ts;
here we check that the server delivers the frontend's index.html and the fallback rules.
"""

from fastapi.testclient import TestClient

from tests.conftest import INDEX_HTML

HTML = {"Accept": "text/html"}


def test_browser_opens_the_start_page(client: TestClient) -> None:
    response = client.get("/", headers=HTML)

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/html")
    assert '<div id="root">' in response.text
    assert response.text == INDEX_HTML


def test_browser_opens_a_deep_link(client: TestClient) -> None:
    start = client.get("/", headers=HTML)
    response = client.get("/games/42", headers=HTML)

    assert response.status_code == 200
    assert response.text == start.text


def test_missing_asset_file(client: TestClient) -> None:
    response = client.get("/assets/missing.js", headers={"Accept": "*/*"})

    assert response.status_code == 404
