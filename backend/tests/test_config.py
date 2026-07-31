from fastapi.testclient import TestClient


def test_public_config_exposes_pushhive_settings(
    client: TestClient, monkeypatch
) -> None:
    from app import config as config_module

    monkeypatch.setenv("PUBLIC_APP_URL", "http://localhost:8000")
    monkeypatch.setenv("PUSHHIVE_URL", "http://pushhive:3000")
    monkeypatch.setenv("PUSHHIVE_PUBLIC_URL", "https://push.lan")
    monkeypatch.setenv("PUSHHIVE_API_KEY", "ph_test_key")
    config_module.get_settings.cache_clear()

    response = client.get("/api/config")
    assert response.status_code == 200
    assert response.json() == {
        "public_app_url": "http://localhost:8000",
        "pushhive_url": "https://push.lan",
        "pushhive_api_key": "ph_test_key",
    }
    config_module.get_settings.cache_clear()
