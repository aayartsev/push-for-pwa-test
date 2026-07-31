from fastapi.testclient import TestClient

from app.services.pushhive import PushResult


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


def test_create_message_marks_sent_when_pushhive_ok(
    client: TestClient, monkeypatch
) -> None:
    monkeypatch.setattr(
        "app.routers.messages.send_test_notification",
        lambda **kwargs: PushResult(ok=True),
    )
    sender = _create_user(client, "Sender")
    receiver = _create_user(client, "Receiver")

    response = client.post(
        "/api/messages",
        json={
            "from_user_id": sender,
            "to_user_id": receiver,
            "text": "Hello",
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["text"] == "Hello"
    assert data["push_status"] == "sent"
    assert data["push_error"] is None

    fetched = client.get(f"/api/messages/{data['id']}")
    assert fetched.status_code == 200
    assert fetched.json()["push_status"] == "sent"


def test_create_message_marks_failed_when_pushhive_errors(
    client: TestClient, monkeypatch
) -> None:
    monkeypatch.setattr(
        "app.routers.messages.send_test_notification",
        lambda **kwargs: PushResult(ok=False, error="down"),
    )
    sender = _create_user(client, "Sender2")
    receiver = _create_user(client, "Receiver2")
    response = client.post(
        "/api/messages",
        json={
            "from_user_id": sender,
            "to_user_id": receiver,
            "text": "Hello",
        },
    )
    assert response.status_code == 201
    assert response.json()["push_status"] == "failed"
    assert response.json()["push_error"] == "down"


def test_message_unknown_user_returns_404(client: TestClient, monkeypatch) -> None:
    monkeypatch.setattr(
        "app.routers.messages.send_test_notification",
        lambda **kwargs: PushResult(ok=True),
    )
    sender = _create_user(client, "OnlySender")
    response = client.post(
        "/api/messages",
        json={
            "from_user_id": sender,
            "to_user_id": "missing-user-id",
            "text": "Hello",
        },
    )
    assert response.status_code == 404
    assert "to_user_id" in response.json()["detail"]


def test_cannot_message_yourself(client: TestClient) -> None:
    user_id = _create_user(client, "Solo")
    response = client.post(
        "/api/messages",
        json={
            "from_user_id": user_id,
            "to_user_id": user_id,
            "text": "Hi me",
        },
    )
    assert response.status_code == 400


def test_get_missing_message_returns_404(client: TestClient) -> None:
    response = client.get("/api/messages/does-not-exist")
    assert response.status_code == 404


def test_list_messages_paginates_conversation(
    client: TestClient, monkeypatch
) -> None:
    monkeypatch.setattr(
        "app.routers.messages.send_test_notification",
        lambda **kwargs: PushResult(ok=True),
    )
    alice = _create_user(client, "AliceList")
    bob = _create_user(client, "BobList")
    outsider = _create_user(client, "OutsiderList")

    for i in range(5):
        assert (
            client.post(
                "/api/messages",
                json={
                    "from_user_id": alice,
                    "to_user_id": bob,
                    "text": f"a-{i}",
                },
            ).status_code
            == 201
        )
    assert (
        client.post(
            "/api/messages",
            json={
                "from_user_id": bob,
                "to_user_id": alice,
                "text": "b-reply",
            },
        ).status_code
        == 201
    )
    assert (
        client.post(
            "/api/messages",
            json={
                "from_user_id": alice,
                "to_user_id": outsider,
                "text": "noise",
            },
        ).status_code
        == 201
    )

    page1 = client.get(
        "/api/messages",
        params={"user_id": alice, "peer_id": bob, "limit": 3, "offset": 0},
    )
    assert page1.status_code == 200
    body = page1.json()
    assert body["total"] == 6
    assert body["limit"] == 3
    assert body["offset"] == 0
    assert len(body["items"]) == 3
    assert body["items"][0]["text"] == "b-reply"

    page2 = client.get(
        "/api/messages",
        params={"user_id": alice, "peer_id": bob, "limit": 3, "offset": 3},
    ).json()
    assert len(page2["items"]) == 3
    assert page2["items"][-1]["text"] == "a-0"

    missing = client.get(
        "/api/messages",
        params={"user_id": alice, "peer_id": "no-such-user"},
    )
    assert missing.status_code == 404


def test_send_passes_message_id_in_click_url(
    client: TestClient, monkeypatch
) -> None:
    captured: dict = {}

    def fake_send(**kwargs):
        captured.update(kwargs)
        return PushResult(ok=True)

    monkeypatch.setattr("app.routers.messages.send_test_notification", fake_send)
    sender = _create_user(client, "UrlSender")
    receiver = _create_user(client, "UrlReceiver")
    created = client.post(
        "/api/messages",
        json={
            "from_user_id": sender,
            "to_user_id": receiver,
            "text": "Hello",
        },
    ).json()
    assert created["id"] in captured["url"]
    assert captured["subscriber_id"] == "sub-UrlReceiver"
    assert "From UrlSender" == captured["title"]
