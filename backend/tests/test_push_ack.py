from fastapi.testclient import TestClient


def _create_user(client: TestClient, name: str) -> str:
    response = client.post(
        "/api/users",
        json={
            "name": name,
            "device_id": f"device-{name}",
            "push_subscriber_id": f"sub-{name}",
        },
    )
    assert response.status_code == 201
    return response.json()["id"]


def test_ack_marks_message_delivered(client: TestClient, monkeypatch) -> None:
    monkeypatch.setattr(
        "app.routers.messages.send_test_notification",
        lambda **kwargs: type("R", (), {"ok": True, "error": None})(),
    )
    sender = _create_user(client, "AckSender")
    receiver = _create_user(client, "AckReceiver")
    created = client.post(
        "/api/messages",
        json={
            "from_user_id": sender,
            "to_user_id": receiver,
            "text": "ping",
        },
    ).json()
    assert created["push_status"] == "sent"

    response = client.post(
        "/api/push/ack",
        json={"message_id": created["id"], "status": "delivered"},
    )
    assert response.status_code == 200
    assert response.json()["push_status"] == "delivered"


def test_ack_rejects_bad_secret(client: TestClient, monkeypatch) -> None:
    from app import config as config_module

    monkeypatch.setenv("ACK_SECRET", "top-secret")
    config_module.get_settings.cache_clear()
    monkeypatch.setattr(
        "app.routers.messages.send_test_notification",
        lambda **kwargs: type("R", (), {"ok": True, "error": None})(),
    )
    sender = _create_user(client, "SecSender")
    receiver = _create_user(client, "SecReceiver")
    message_id = client.post(
        "/api/messages",
        json={
            "from_user_id": sender,
            "to_user_id": receiver,
            "text": "ping",
        },
    ).json()["id"]

    denied = client.post(
        "/api/push/ack",
        json={"message_id": message_id, "status": "delivered"},
    )
    assert denied.status_code == 401

    ok = client.post(
        "/api/push/ack",
        headers={"X-Ack-Secret": "top-secret"},
        json={"message_id": message_id, "status": "delivered"},
    )
    assert ok.status_code == 200
    config_module.get_settings.cache_clear()
