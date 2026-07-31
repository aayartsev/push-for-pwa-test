"""Users API."""

from __future__ import annotations

import sqlite3
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException

from app.db import get_connection
from app.models import UserCreate, UserCreated, UserOut

router = APIRouter(prefix="/api/users", tags=["users"])


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


@router.post("", response_model=UserCreated, status_code=201)
def create_user(payload: UserCreate) -> UserCreated:
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=422, detail="name must not be empty")

    user_id = str(uuid.uuid4())
    created_at = _utc_now()

    try:
        with get_connection() as conn:
            conn.execute(
                """
                INSERT INTO users (id, name, device_id, push_subscriber_id, created_at)
                VALUES (?, ?, ?, ?, ?)
                """,
                (
                    user_id,
                    name,
                    payload.device_id,
                    payload.push_subscriber_id,
                    created_at,
                ),
            )
    except sqlite3.IntegrityError as exc:
        if "UNIQUE" in str(exc).upper() or "unique" in str(exc).lower():
            raise HTTPException(status_code=409, detail="name already taken") from exc
        raise

    return UserCreated(
        id=user_id,
        name=name,
        device_id=payload.device_id,
        push_subscriber_id=payload.push_subscriber_id,
        created_at=created_at,
    )


@router.get("", response_model=list[UserOut])
def list_users() -> list[UserOut]:
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT id, name FROM users ORDER BY created_at ASC, name ASC"
        ).fetchall()
    return [UserOut(id=row["id"], name=row["name"]) for row in rows]
