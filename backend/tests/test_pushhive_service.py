from __future__ import annotations

import httpx

from app.services.pushhive import send_test_notification


def test_send_test_notification_success(monkeypatch) -> None:
    from app import config as config_module

    monkeypatch.setenv("PUSHHIVE_URL", "http://pushhive:3000")
    monkeypatch.setenv("PUSHHIVE_API_KEY", "ph_secret")
    config_module.get_settings.cache_clear()

    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/api/v1/test/sub-123"
        assert request.headers["x-api-key"] == "ph_secret"
        return httpx.Response(200, json={"success": True})

    transport = httpx.MockTransport(handler)
    with httpx.Client(transport=transport) as client:
        result = send_test_notification(
            subscriber_id="sub-123",
            title="From Alice",
            body="Hi",
            url="http://app/?m=1",
            client=client,
        )
    assert result.ok is True
    assert result.error is None
    config_module.get_settings.cache_clear()


def test_send_test_notification_http_error(monkeypatch) -> None:
    from app import config as config_module

    monkeypatch.setenv("PUSHHIVE_URL", "http://pushhive:3000")
    monkeypatch.setenv("PUSHHIVE_API_KEY", "ph_secret")
    config_module.get_settings.cache_clear()

    transport = httpx.MockTransport(
        lambda request: httpx.Response(500, text="boom")
    )
    with httpx.Client(transport=transport) as client:
        result = send_test_notification(
            subscriber_id="sub-123",
            title="From Alice",
            body="Hi",
            url="http://app/?m=1",
            client=client,
        )
    assert result.ok is False
    assert "500" in (result.error or "")
    config_module.get_settings.cache_clear()


def test_send_test_notification_requires_api_key(monkeypatch) -> None:
    from app import config as config_module

    monkeypatch.setenv("PUSHHIVE_API_KEY", "")
    monkeypatch.setenv("PUSHHIVE_URL", "http://pushhive:3000")
    config_module.get_settings.cache_clear()
    result = send_test_notification(
        subscriber_id="sub",
        title="t",
        body="b",
        url="http://app/",
    )
    assert result.ok is False
    assert "PUSHHIVE_API_KEY" in (result.error or "")
    config_module.get_settings.cache_clear()
