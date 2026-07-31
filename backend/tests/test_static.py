from fastapi.testclient import TestClient


def test_index_serves_html(client: TestClient) -> None:
    response = client.get("/")
    assert response.status_code == 200
    assert "text/html" in response.headers["content-type"]
    assert "PWA Push Messenger" in response.text


def test_static_app_js_is_served(client: TestClient) -> None:
    response = client.get("/static/app.js")
    assert response.status_code == 200
    assert "getAppTitle" in response.text


def test_manifest_is_served(client: TestClient) -> None:
    response = client.get("/static/manifest.webmanifest")
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "PWA Push Messenger"
    assert data["display"] == "standalone"


def test_service_worker_is_served(client: TestClient) -> None:
    response = client.get("/static/sw.js")
    assert response.status_code == 200
    assert "skipWaiting" in response.text


def test_service_worker_root_route(client: TestClient) -> None:
    response = client.get("/sw.js")
    assert response.status_code == 200
    assert "push" in response.text
    assert response.headers.get("service-worker-allowed") == "/"
