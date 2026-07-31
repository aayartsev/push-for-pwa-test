"""Messages API with PushHive delivery."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from urllib.parse import urlencode

from fastapi import APIRouter, HTTPException, Query

from app.config import get_settings
from app.db import get_connection
from app.models import MessageCreate, MessageListOut, MessageOut
from app.services.pushhive import send_test_notification

router = APIRouter(prefix="/api/messages", tags=["messages"])


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _row_to_message(row) -> MessageOut:
    return MessageOut(
        id=row["id"],
        text=row["text"],
        from_user_id=row["from_user_id"],
        to_user_id=row["to_user_id"],
        push_status=row["push_status"],
        push_error=row["push_error"],
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


@router.get("", response_model=MessageListOut)
def list_messages(
    user_id: str = Query(min_length=1),
    peer_id: str = Query(min_length=1),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> MessageListOut:
    """Переписка user_id ↔ peer_id, новые сверху, с пагинацией."""
    if user_id == peer_id:
        raise HTTPException(status_code=400, detail="user_id and peer_id must differ")

    with get_connection() as conn:
        for uid, label in ((user_id, "user_id"), (peer_id, "peer_id")):
            exists = conn.execute(
                "SELECT 1 FROM users WHERE id = ?", (uid,)
            ).fetchone()
            if exists is None:
                raise HTTPException(status_code=404, detail=f"{label} not found")

        total_row = conn.execute(
            """
            SELECT COUNT(*) AS cnt FROM messages
            WHERE (from_user_id = ? AND to_user_id = ?)
               OR (from_user_id = ? AND to_user_id = ?)
            """,
            (user_id, peer_id, peer_id, user_id),
        ).fetchone()
        total = int(total_row["cnt"])

        rows = conn.execute(
            """
            SELECT * FROM messages
            WHERE (from_user_id = ? AND to_user_id = ?)
               OR (from_user_id = ? AND to_user_id = ?)
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?
            """,
            (user_id, peer_id, peer_id, user_id, limit, offset),
        ).fetchall()

    return MessageListOut(
        items=[_row_to_message(row) for row in rows],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.post("", response_model=MessageOut, status_code=201)
def create_message(payload: MessageCreate) -> MessageOut:
    text = payload.text.strip()
    if not text:
        raise HTTPException(status_code=422, detail="text must not be empty")
    if payload.from_user_id == payload.to_user_id:
        raise HTTPException(status_code=400, detail="cannot send message to yourself")

    settings = get_settings()
    with get_connection() as conn:
        sender = conn.execute(
            "SELECT id, name FROM users WHERE id = ?", (payload.from_user_id,)
        ).fetchone()
        receiver = conn.execute(
            "SELECT id, name, push_subscriber_id FROM users WHERE id = ?",
            (payload.to_user_id,),
        ).fetchone()
        if sender is None:
            raise HTTPException(status_code=404, detail="from_user_id not found")
        if receiver is None:
            raise HTTPException(status_code=404, detail="to_user_id not found")

        message_id = str(uuid.uuid4())
        now = _utc_now()
        conn.execute(
            """
            INSERT INTO messages (
                id, text, from_user_id, to_user_id,
                push_status, push_error, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, NULL, ?, ?)
            """,
            (
                message_id,
                text,
                payload.from_user_id,
                payload.to_user_id,
                "pending",
                now,
                now,
            ),
        )

        click_url = (
            f"{settings.public_app_url.rstrip('/')}/?{urlencode({'m': message_id})}"
        )
        result = send_test_notification(
            subscriber_id=receiver["push_subscriber_id"],
            title=f"From {sender['name']}",
            body=text,
            url=click_url,
            icon=f"{settings.public_app_url.rstrip('/')}/static/icons/icon-192.png",
        )

        if result.ok:
            push_status = "sent"
            push_error = None
        else:
            push_status = "failed"
            push_error = result.error

        updated_at = _utc_now()
        conn.execute(
            """
            UPDATE messages
            SET push_status = ?, push_error = ?, updated_at = ?
            WHERE id = ?
            """,
            (push_status, push_error, updated_at, message_id),
        )

    return MessageOut(
        id=message_id,
        text=text,
        from_user_id=payload.from_user_id,
        to_user_id=payload.to_user_id,
        push_status=push_status,  # type: ignore[arg-type]
        push_error=push_error,
        created_at=now,
        updated_at=updated_at,
    )


@router.get("/{message_id}", response_model=MessageOut)
def get_message(message_id: str) -> MessageOut:
    with get_connection() as conn:
        row = conn.execute(
            "SELECT * FROM messages WHERE id = ?", (message_id,)
        ).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="message not found")
    return _row_to_message(row)
