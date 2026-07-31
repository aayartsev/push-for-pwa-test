from fastapi.testclient import TestClient


def test_index_contains_owl_and_three_screen_app(client: TestClient) -> None:
    html = client.get("/").text
    assert "/static/libs/owl.iife.js" in html
    assert "cdn.jsdelivr" not in html
    assert "/static/app.js" in html

    owl = client.get("/static/libs/owl.iife.js")
    assert owl.status_code == 200
    assert "exports" in owl.text or "owl" in owl.text.lower()

    app_js = client.get("/static/app.js").text
    assert "register" in app_js
    assert "users" in app_js
    assert "compose" in app_js
    assert "beforeinstallprompt" in app_js
