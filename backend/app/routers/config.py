"""Public runtime config for the SPA."""

from __future__ import annotations

from fastapi import APIRouter

from app.config import get_settings

router = APIRouter(prefix="/api", tags=["config"])


@router.get("/config")
def get_public_config() -> dict[str, str]:
    settings = get_settings()
    return {
        "public_app_url": settings.public_app_url,
        "pushhive_url": settings.pushhive_browser_url,
        "pushhive_api_key": settings.pushhive_api_key,
    }
