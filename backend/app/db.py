"""SQLite connection and schema initialization."""

from __future__ import annotations

import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator

SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    device_id TEXT NOT NULL,
    push_subscriber_id TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    text TEXT NOT NULL,
    from_user_id TEXT NOT NULL,
    to_user_id TEXT NOT NULL,
    push_status TEXT NOT NULL,
    push_error TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (from_user_id) REFERENCES users(id),
    FOREIGN KEY (to_user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_messages_from ON messages(from_user_id);
CREATE INDEX IF NOT EXISTS idx_messages_to ON messages(to_user_id);
"""


def get_database_path() -> Path:
    raw = os.environ.get("DATABASE_PATH", "data/app.db")
    path = Path(raw)
    path.parent.mkdir(parents=True, exist_ok=True)
    return path


def connect(db_path: Path | None = None) -> sqlite3.Connection:
    path = db_path or get_database_path()
    conn = sqlite3.connect(str(path), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db(db_path: Path | None = None) -> Path:
    path = db_path or get_database_path()
    with connect(path) as conn:
        conn.executescript(SCHEMA_SQL)
        conn.commit()
    return path


@contextmanager
def get_connection(db_path: Path | None = None) -> Iterator[sqlite3.Connection]:
    conn = connect(db_path)
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
