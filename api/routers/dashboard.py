"""
Dashboard data endpoint.

Returns the last N days of processed messages with full metadata
for client-side filtering by the frontend.
"""
from __future__ import annotations
import json
import logging

import asyncpg
from fastapi import APIRouter, Depends

log = logging.getLogger(__name__)
router = APIRouter()


def _get_pool():
    from main import get_pool
    return get_pool()


@router.get("/dashboard")  # reachable via /api/dashboard through Next.js rewrite
async def get_dashboard(
    days: int = 30,
    pool: asyncpg.Pool = Depends(_get_pool),
):
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT
                m.id,
                m.date,
                m.channel_name,
                m.raw_text,
                p.translation,
                p.detected_language,
                p.categories,
                p.geocoded_locations
            FROM messages m
            JOIN processed_messages p ON m.id = p.id
            WHERE m.date >= NOW() - ($1::int * INTERVAL '1 day')
            ORDER BY m.date DESC
            LIMIT 5000
            """,
            days,
        )
        channel_rows = await conn.fetch(
            "SELECT DISTINCT channel_name FROM messages ORDER BY channel_name"
        )

    messages = []
    for row in rows:
        geo = row["geocoded_locations"]
        if isinstance(geo, str):
            try:
                geo = json.loads(geo)
            except Exception:
                geo = []
        elif geo is None:
            geo = []

        city = lat = lon = None
        if geo:
            first = geo[0]
            city = first.get("name")
            lat = first.get("lat")
            lon = first.get("lon")

        messages.append({
            "id": row["id"],
            "timestamp": row["date"].isoformat(),
            "channel": row["channel_name"],
            "city": city,
            "lat": lat,
            "lon": lon,
            "categories": list(row["categories"] or []),
            "text_translated": row["translation"],
            "text_original": row["raw_text"],
            "lang": row["detected_language"],
        })

    return {
        "messages": messages,
        "channels": [r["channel_name"] for r in channel_rows],
    }
