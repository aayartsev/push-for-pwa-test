"""Client for PushHive test-send API."""

from __future__ import annotations

from dataclasses import dataclass

import httpx

from app.config import get_settings


@dataclass
class PushResult:
    ok: bool
    error: str | None = None


def send_test_notification(
    *,
    subscriber_id: str,
    title: str,
    body: str,
    url: str,
    icon: str = "",
    client: httpx.Client | None = None,
) -> PushResult:
    settings = get_settings()
    if not settings.pushhive_api_key:
        return PushResult(ok=False, error="PUSHHIVE_API_KEY is not configured")
    if not settings.pushhive_url:
        return PushResult(ok=False, error="PUSHHIVE_URL is not configured")

    endpoint = (
        f"{settings.pushhive_url.rstrip('/')}/api/v1/test/{subscriber_id}"
    )
    headers = {"X-API-Key": settings.pushhive_api_key}
    payload = {"title": title, "body": body, "url": url, "icon": icon}

    owns_client = client is None
    http = client or httpx.Client(timeout=15.0)
    try:
        response = http.post(endpoint, json=payload, headers=headers)
        if response.is_success:
            return PushResult(ok=True)
        detail = response.text[:500]
        return PushResult(
            ok=False,
            error=f"PushHive HTTP {response.status_code}: {detail}",
        )
    except httpx.HTTPError as exc:
        return PushResult(ok=False, error=str(exc))
    finally:
        if owns_client:
            http.close()
