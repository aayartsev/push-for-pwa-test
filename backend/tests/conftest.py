from __future__ import annotations

import os
from pathlib import Path

import pytest
from fastapi.testclient import TestClient


@pytest.fixture()
def tmp_db(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    db_path = tmp_path / "test.db"
    frontend = Path(__file__).resolve().parents[2] / "frontend"
    monkeypatch.setenv("DATABASE_PATH", str(db_path))
    monkeypatch.setenv("FRONTEND_DIR", str(frontend))
    # Reset cached settings between tests
    from app import config

    config.get_settings.cache_clear()
    yield db_path
    config.get_settings.cache_clear()


@pytest.fixture()
def client(tmp_db: Path) -> TestClient:
    # Import after env is set so startup uses temp DB
    from app.main import app

    with TestClient(app) as test_client:
        yield test_client
