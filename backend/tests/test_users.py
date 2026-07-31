from fastapi.testclient import TestClient


def test_create_user_returns_201(client: TestClient) -> None:
    response = client.post(
        "/api/users",
        json={
            "name": "Alice",
            "device_id": "device-1",
            "push_subscriber_id": "sub-1",
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Alice"
    assert data["device_id"] == "device-1"
    assert data["push_subscriber_id"] == "sub-1"
    assert data["id"]
    assert data["created_at"]


def test_duplicate_name_returns_409(client: TestClient) -> None:
    payload = {
        "name": "Bob",
        "device_id": "device-2",
        "push_subscriber_id": "sub-2",
    }
    assert client.post("/api/users", json=payload).status_code == 201
    response = client.post(
        "/api/users",
        json={
            "name": "Bob",
            "device_id": "device-3",
            "push_subscriber_id": "sub-3",
        },
    )
    assert response.status_code == 409
    assert "name already taken" in response.json()["detail"]


def test_list_users_includes_registered(client: TestClient) -> None:
    client.post(
        "/api/users",
        json={
            "name": "Carol",
            "device_id": "d-c",
            "push_subscriber_id": "s-c",
        },
    )
    client.post(
        "/api/users",
        json={
            "name": "Dave",
            "device_id": "d-d",
            "push_subscriber_id": "s-d",
        },
    )
    response = client.get("/api/users")
    assert response.status_code == 200
    names = {user["name"] for user in response.json()}
    assert names == {"Carol", "Dave"}
    for user in response.json():
        assert set(user.keys()) == {"id", "name"}


def test_create_user_trims_name(client: TestClient) -> None:
    response = client.post(
        "/api/users",
        json={
            "name": "  Eve  ",
            "device_id": "d-e",
            "push_subscriber_id": "s-e",
        },
    )
    assert response.status_code == 201
    assert response.json()["name"] == "Eve"
