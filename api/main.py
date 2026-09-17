import logging
from contextlib import asynccontextmanager

import asyncpg
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from modules.applog import configure_logging
from modules.dbcreds import resolve_postgres_dsn
from routers import dashboard as dashboard_router
from routers import chat as chat_router

configure_logging()
log = logging.getLogger(__name__)

_pool: asyncpg.Pool | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _pool
    dsn = resolve_postgres_dsn()
    _pool = await asyncpg.create_pool(dsn, min_size=5, max_size=20)
    log.info("postgres pool ready")
    yield
    await _pool.close()
    log.info("postgres pool closed")


app = FastAPI(
    title="Open Seldon API",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(GZipMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:8080",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(dashboard_router.router)
app.include_router(chat_router.router)


def get_pool() -> asyncpg.Pool:
    assert _pool is not None, "pool not initialized"
    return _pool


@app.get("/health")
async def health():
    pool = get_pool()
    async with pool.acquire() as conn:
        count = await conn.fetchval("SELECT COUNT(*) FROM messages")
    return {"status": "ok", "message_count": count}
