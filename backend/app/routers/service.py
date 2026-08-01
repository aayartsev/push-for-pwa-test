"""Service helpers: cleanup of users with expired push subscriptions."""

from __future__ import annotations

import re

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from app.db import get_connection

router = APIRouter(prefix="/api/service", tags=["service"])

STALE_ERROR_RE = re.compile(
    r"unsubscribed or expired|unexpected response code|\b410\b",
    re.IGNORECASE,
)


class StaleUserOut(BaseModel):
    id: str
    name: str
    failed_count: int
    last_error: str | None = None


class StaleListOut(BaseModel):
    items: list[StaleUserOut]


class PurgeStaleBody(BaseModel):
    keep_user_id: str | None = Field(default=None, min_length=1)


class PurgeStaleOut(BaseModel):
    deleted_users: list[StaleUserOut]
    deleted_user_count: int
    deleted_message_count: int


def _stale_rows(conn, keep_user_id: str | None = None) -> list:
    rows = conn.execute(
        """
        SELECT
            u.id AS id,
            u.name AS name,
            COUNT(m.id) AS failed_count,
            MAX(m.push_error) AS last_error
        FROM users u
        JOIN messages m ON m.to_user_id = u.id
        WHERE m.push_status = 'failed'
          AND m.push_error IS NOT NULL
          AND (? IS NULL OR u.id != ?)
        GROUP BY u.id, u.name
        ORDER BY u.name ASC
        """,
        (keep_user_id, keep_user_id),
    ).fetchall()
    return [
        row
        for row in rows
        if row["last_error"] and STALE_ERROR_RE.search(row["last_error"])
    ]


def _delete_user_cascade(conn, user_id: str) -> int:
    msg = conn.execute(
        """
        DELETE FROM messages
        WHERE from_user_id = ? OR to_user_id = ?
        """,
        (user_id, user_id),
    )
    deleted_messages = msg.rowcount
    conn.execute("DELETE FROM users WHERE id = ?", (user_id,))
    return int(deleted_messages)


@router.get("/stale-users", response_model=StaleListOut)
def list_stale_users(
    keep_user_id: str | None = Query(default=None, min_length=1),
) -> StaleListOut:
    with get_connection() as conn:
        rows = _stale_rows(conn, keep_user_id)
    return StaleListOut(
        items=[
            StaleUserOut(
                id=row["id"],
                name=row["name"],
                failed_count=int(row["failed_count"]),
                last_error=row["last_error"],
            )
            for row in rows
        ]
    )


@router.post("/purge-stale", response_model=PurgeStaleOut)
def purge_stale_users(payload: PurgeStaleBody) -> PurgeStaleOut:
    with get_connection() as conn:
        rows = _stale_rows(conn, payload.keep_user_id)
        deleted_users: list[StaleUserOut] = []
        deleted_message_count = 0
        for row in rows:
            deleted_message_count += _delete_user_cascade(conn, row["id"])
            deleted_users.append(
                StaleUserOut(
                    id=row["id"],
                    name=row["name"],
                    failed_count=int(row["failed_count"]),
                    last_error=row["last_error"],
                )
            )
    return PurgeStaleOut(
        deleted_users=deleted_users,
        deleted_user_count=len(deleted_users),
        deleted_message_count=deleted_message_count,
    )


@router.delete("/users/{user_id}", response_model=PurgeStaleOut)
def delete_user(
    user_id: str,
    keep_user_id: str | None = Query(default=None, min_length=1),
) -> PurgeStaleOut:
    if keep_user_id and user_id == keep_user_id:
        raise HTTPException(status_code=400, detail="cannot delete current user")

    with get_connection() as conn:
        row = conn.execute(
            "SELECT id, name FROM users WHERE id = ?", (user_id,)
        ).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="user not found")
        deleted_message_count = _delete_user_cascade(conn, user_id)

    return PurgeStaleOut(
        deleted_users=[
            StaleUserOut(id=row["id"], name=row["name"], failed_count=0, last_error=None)
        ],
        deleted_user_count=1,
        deleted_message_count=deleted_message_count,
    )
