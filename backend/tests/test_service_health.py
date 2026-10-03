"""Scenarios from openspec/changes/add-project-skeleton/specs/service-health/spec.md."""

from fastapi.testclient import TestClient


def test_health_check_succeeds(client: TestClient) -> None:
    response = client.get("/api/health")

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/json")
    assert response.json() == {"status": "ok"}


def test_api_client_requests_unknown_api_path(client: TestClient) -> None:
    response = client.get("/api/does-not-exist", headers={"Accept": "application/json"})

    assert response.status_code == 404
    assert response.headers["content-type"].startswith("application/json")


def test_browser_navigates_to_unknown_api_path(client: TestClient) -> None:
    response = client.get("/api/does-not-exist", headers={"Accept": "text/html"})

    assert response.status_code == 404
    assert response.headers["content-type"].startswith("application/json")
    assert '<div id="root">' not in response.text


# openspec/changes/api-method-not-allowed:
# known paths reject unsupported methods with 405; unknown paths stay 404 for every method.


def test_post_to_the_health_endpoint(client: TestClient) -> None:
    response = client.post("/api/health")

    assert response.status_code == 405
    assert response.headers["content-type"].startswith("application/json")
    assert response.headers["allow"] == "GET"


def test_delete_to_the_health_endpoint(client: TestClient) -> None:
    response = client.delete("/api/health")

    assert response.status_code == 405
    assert response.headers["content-type"].startswith("application/json")
    assert response.headers["allow"] == "GET"


def test_non_get_request_to_unknown_api_path(client: TestClient) -> None:
    response = client.post("/api/does-not-exist")

    assert response.status_code == 404
    assert response.headers["content-type"].startswith("application/json")
    assert "allow" not in response.headers
