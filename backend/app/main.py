"""FastAPI application entrypoint."""

from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path
from typing import AsyncIterator

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.config import get_settings
from app.db import init_db
from app.routers import config, messages, push_ack, service, users


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()
    init_db(Path(settings.database_path))
    yield


app = FastAPI(title="PWA Push Messenger", version="0.1.0", lifespan=lifespan)

app.include_router(config.router)
app.include_router(users.router)
app.include_router(messages.router)
app.include_router(push_ack.router)
app.include_router(service.router)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


def _frontend_root() -> Path:
    settings = get_settings()
    root = Path(settings.frontend_dir)
    if not root.is_absolute():
        root = (Path(__file__).resolve().parent.parent / root).resolve()
    return root


frontend_root = _frontend_root()
if frontend_root.is_dir():
    @app.get("/")
    def index() -> FileResponse:
        return FileResponse(frontend_root / "index.html")

    @app.get("/sw.js")
    def service_worker() -> FileResponse:
        return FileResponse(
            frontend_root / "sw.js",
            media_type="application/javascript",
            headers={"Service-Worker-Allowed": "/"},
        )

    app.mount("/static", StaticFiles(directory=str(frontend_root)), name="static")
