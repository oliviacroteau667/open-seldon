"""Identity endpoints: who am I, and which organizations am I in."""
from __future__ import annotations

import asyncpg
from fastapi import APIRouter, Depends

from modules.auth import _get_pool, current_user

router = APIRouter()


@router.get("/me")
async def me(
    user: dict = Depends(current_user),
    pool: asyncpg.Pool = Depends(_get_pool),
):
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT o.id, o.slug, o.name, m.role
            FROM org_members m
            JOIN organizations o ON o.id = m.org_id
            WHERE m.user_id = $1
            ORDER BY o.name
            """,
            user["id"],
        )
    return {
        "user": user,
        "organizations": [{**dict(r), "id": str(r["id"])} for r in rows],
    }
