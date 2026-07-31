"""Application settings loaded from environment."""

from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    public_app_url: str = "http://localhost:8000"
    # Internal URL used by FastAPI → PushHive (docker network).
    pushhive_url: str = "http://localhost:3000"
    # Browser-facing PushHive URL (HTTPS host / public port). Falls back to pushhive_url.
    pushhive_public_url: str = ""
    pushhive_api_key: str = ""
    database_path: str = "data/app.db"
    ack_secret: str = ""
    frontend_dir: str = "../frontend"

    @property
    def pushhive_browser_url(self) -> str:
        return self.pushhive_public_url or self.pushhive_url


@lru_cache
def get_settings() -> Settings:
    return Settings()
