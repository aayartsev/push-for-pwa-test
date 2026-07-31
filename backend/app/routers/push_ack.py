"""Push delivery acknowledgement from the service worker."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field

from app.config import get_settings
from app.db import get_connection
from app.models import MessageOut

router = APIRouter(prefix="/api/push", tags=["push"])


class AckBody(BaseModel):
    message_id: str = Field(min_length=1)
    status: str = Field(default="delivered")


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


@router.post("/ack", response_model=MessageOut)
def acknowledge_delivery(
    payload: AckBody,
    x_ack_secret: str | None = Header(default=None),
) -> MessageOut:
    settings = get_settings()
    if settings.ack_secret and x_ack_secret != settings.ack_secret:
        raise HTTPException(status_code=401, detail="invalid ack secret")

    if payload.status != "delivered":
        raise HTTPException(status_code=422, detail="only delivered status is supported")

    now = _utc_now()
    with get_connection() as conn:
        row = conn.execute(
            "SELECT * FROM messages WHERE id = ?", (payload.message_id,)
        ).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="message not found")

        conn.execute(
            """
            UPDATE messages
            SET push_status = ?, push_error = NULL, updated_at = ?
            WHERE id = ?
            """,
            ("delivered", now, payload.message_id),
        )
        row = conn.execute(
            "SELECT * FROM messages WHERE id = ?", (payload.message_id,)
        ).fetchone()

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
