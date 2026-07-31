"""Pydantic models for API request/response bodies."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class UserCreate(BaseModel):
    name: str = Field(min_length=1, max_length=64)
    device_id: str = Field(min_length=1, max_length=128)
    push_subscriber_id: str = Field(min_length=1, max_length=128)


class UserOut(BaseModel):
    id: str
    name: str


class UserCreated(UserOut):
    device_id: str
    push_subscriber_id: str
    created_at: str


class MessageCreate(BaseModel):
    from_user_id: str = Field(min_length=1)
    to_user_id: str = Field(min_length=1)
    text: str = Field(min_length=1, max_length=2000)


PushStatus = Literal["pending", "sent", "failed", "delivered"]


class MessageOut(BaseModel):
    id: str
    text: str
    from_user_id: str
    to_user_id: str
    push_status: PushStatus
    push_error: str | None = None
    created_at: str
    updated_at: str
