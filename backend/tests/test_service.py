from fastapi.testclient import TestClient


def _create_user(client: TestClient, name: str, sub: str) -> dict:
    response = client.post(
        "/api/users",
        json={
            "name": name,
            "device_id": f"d-{name}",
            "push_subscriber_id": sub,
        },
    )
    assert response.status_code == 201
    return response.json()


def test_purge_stale_users_removes_expired_recipients(
    client: TestClient, monkeypatch
) -> None:
    sender = _create_user(client, "Sender", "sub-sender")
    stale = _create_user(client, "Stale", "sub-stale")
    alive = _create_user(client, "Alive", "sub-alive")

    def fake_push(*, subscriber_id: str, **_kwargs):
        from app.services.pushhive import PushResult

        if subscriber_id == "sub-stale":
            return PushResult(
                ok=False,
                error='PushHive HTTP 500: {"error":"Test notification failed: Received unexpected response code"}',
            )
        return PushResult(ok=True)

    monkeypatch.setattr(
        "app.routers.messages.send_test_notification", fake_push
    )

    failed = client.post(
        "/api/messages",
        json={
            "from_user_id": sender["id"],
            "to_user_id": stale["id"],
            "text": "boom",
        },
    )
    assert failed.status_code == 201
    assert failed.json()["push_status"] == "failed"

    ok = client.post(
        "/api/messages",
        json={
            "from_user_id": sender["id"],
            "to_user_id": alive["id"],
            "text": "hi",
        },
    )
    assert ok.status_code == 201
    assert ok.json()["push_status"] == "sent"

    preview = client.get(
        "/api/service/stale-users",
        params={"keep_user_id": sender["id"]},
    )
    assert preview.status_code == 200
    names = {item["name"] for item in preview.json()["items"]}
    assert names == {"Stale"}

    purged = client.post(
        "/api/service/purge-stale",
        json={"keep_user_id": sender["id"]},
    )
    assert purged.status_code == 200
    body = purged.json()
    assert body["deleted_user_count"] == 1
    assert body["deleted_message_count"] >= 1
    assert body["deleted_users"][0]["name"] == "Stale"

    users = {user["name"] for user in client.get("/api/users").json()}
    assert users == {"Sender", "Alive"}


def test_delete_user_keeps_current(client: TestClient) -> None:
    me = _create_user(client, "Me", "sub-me")
    other = _create_user(client, "Other", "sub-other")

    blocked = client.delete(
        f"/api/service/users/{me['id']}",
        params={"keep_user_id": me["id"]},
    )
    assert blocked.status_code == 400

    deleted = client.delete(
        f"/api/service/users/{other['id']}",
        params={"keep_user_id": me["id"]},
    )
    assert deleted.status_code == 200
    assert deleted.json()["deleted_user_count"] == 1
    names = {user["name"] for user in client.get("/api/users").json()}
    assert names == {"Me"}
