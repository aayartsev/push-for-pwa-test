from __future__ import annotations

from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[2]


def test_caddyfiles_exist_with_expected_hosts() -> None:
    local = (ROOT / "caddy" / "Caddyfile.local").read_text(encoding="utf-8")
    assert "reverse_proxy app:8000" in local
    assert "reverse_proxy pushhive:3000" in local

    https = (ROOT / "caddy" / "Caddyfile.https").read_text(encoding="utf-8")
    assert "pwa.lan" in https
    assert "push.lan" in https
    assert "/certs/pwa.lan.pem" in https

    public = (ROOT / "caddy" / "Caddyfile.public").read_text(encoding="utf-8")
    assert "PUBLIC_APP_HOST" in public
    assert "PUBLIC_PUSH_HOST" in public


def test_compose_overrides_define_caddy() -> None:
    for name in (
        "docker-compose.local.yml",
        "docker-compose.https.yml",
        "docker-compose.public.yml",
    ):
        data = yaml.safe_load((ROOT / name).read_text(encoding="utf-8"))
        assert "caddy" in data["services"]
        assert data["services"]["caddy"]["image"].startswith("caddy:")


def test_gen_mkcert_script_mentions_hosts() -> None:
    script = (ROOT / "scripts" / "gen-mkcert.sh").read_text(encoding="utf-8")
    assert "mkcert" in script
    assert "pwa.lan" in script
    assert "push.lan" in script
