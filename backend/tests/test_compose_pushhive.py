from __future__ import annotations

from pathlib import Path

import pytest
import yaml

ROOT = Path(__file__).resolve().parents[2]


def test_compose_file_lists_pushhive_stack() -> None:
    compose = yaml.safe_load((ROOT / "docker-compose.yml").read_text(encoding="utf-8"))
    services = set(compose["services"])
    assert {
        "app",
        "pushhive",
        "pushhive-worker",
        "pushhive-mongo",
        "pushhive-redis",
    } <= services


def test_pushhive_build_context_is_vendor() -> None:
    compose = yaml.safe_load((ROOT / "docker-compose.yml").read_text(encoding="utf-8"))
    assert compose["services"]["pushhive"]["build"]["context"] == "./vendor/pushhive"
    assert compose["services"]["pushhive-worker"]["build"]["context"] == "./vendor/pushhive"


def test_setup_script_mentions_clone_and_vapid() -> None:
    script = (ROOT / "scripts" / "setup-pushhive.sh").read_text(encoding="utf-8")
    assert "dhirendralive9/pushhive" in script
    assert "VAPID_PUBLIC_KEY" in script
    assert "vendor/pushhive" in script


def test_seed_script_updates_api_key() -> None:
    script = (ROOT / "scripts" / "seed-pushhive.sh").read_text(encoding="utf-8")
    assert "PUSHHIVE_API_KEY" in script
    assert "create-site.js" in script
    assert "seed.js" in script


def test_create_site_script_disables_welcome() -> None:
    script = (ROOT / "scripts" / "create-site.js").read_text(encoding="utf-8")
    assert "welcomeNotification" in script
    assert "enabled: false" in script
