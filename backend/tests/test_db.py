from pathlib import Path

import sqlite3

from app.db import SCHEMA_SQL, init_db


def test_init_db_creates_users_and_messages_tables(tmp_path: Path) -> None:
    db_path = tmp_path / "schema.db"
    init_db(db_path)

    conn = sqlite3.connect(str(db_path))
    try:
        tables = {
            row[0]
            for row in conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table'"
            ).fetchall()
        }
        assert "users" in tables
        assert "messages" in tables

        users_cols = {
            row[1] for row in conn.execute("PRAGMA table_info(users)").fetchall()
        }
        assert users_cols == {
            "id",
            "name",
            "device_id",
            "push_subscriber_id",
            "created_at",
        }

        messages_cols = {
            row[1] for row in conn.execute("PRAGMA table_info(messages)").fetchall()
        }
        assert messages_cols == {
            "id",
            "text",
            "from_user_id",
            "to_user_id",
            "push_status",
            "push_error",
            "created_at",
            "updated_at",
        }
    finally:
        conn.close()


def test_schema_sql_mentions_unique_name() -> None:
    assert "name TEXT NOT NULL UNIQUE" in SCHEMA_SQL
