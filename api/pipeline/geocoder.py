"""
Geocode extracted location strings to lat/lon using Gemini Flash via OpenRouter.
Replaces Nominatim to avoid public API rate limits and handle context better.

Batches all locations for a message into a single LLM call.
Updates processed_messages.geocoded_locations as [{name, lat, lon}].

Usage:
    python -m pipeline.geocoder
    python -m pipeline.geocoder --batch-size 50
"""
import asyncio
import json
import logging

import asyncpg

from modules.dbcreds import resolve_postgres_dsn
from modules.llm import openrouter_client, PIPELINE_MODEL

log = logging.getLogger(__name__)

SYSTEM_PROMPT = """\
You are a geocoder for locations mentioned in Ukrainian refugee Telegram channels in Poland.
Given a list of location strings, return coordinates for each real, geocodeable place.
Skip anything that is not a place (e.g. nationalities, adjectives, vague terms).

Respond with JSON:
{"results": [{"name": "Warsaw", "lat": 52.2297, "lon": 21.0122}, ...]}

Only include entries where you are confident in the coordinates.
Return an empty results list if none of the inputs are geocodeable places."""


async def geocode_locations(client, locations: list[str]) -> list[dict]:
    if not locations:
        return []
    try:
        response = await client.chat.completions.create(
            model=PIPELINE_MODEL,
            max_tokens=512,
            temperature=0,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": json.dumps(locations)},
            ],
        )
        data = json.loads(response.choices[0].message.content)
        results = data.get("results", [])
        return [
            r for r in results
            if isinstance(r.get("lat"), (int, float))
            and isinstance(r.get("lon"), (int, float))
        ]
    except Exception:
        log.exception("geocoding failed for locations: %s", locations)
        return []


async def geocode_batch(batch_size: int = 50) -> None:
    client = openrouter_client()
    pool = await asyncpg.create_pool(resolve_postgres_dsn(), min_size=2, max_size=5)

    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT id, locations
            FROM processed_messages
            WHERE locations IS NOT NULL
              AND geocoded_locations IS NULL
            LIMIT $1
            """,
            batch_size,
        )

    log.info("geocoding locations for %d messages", len(rows))

    for row in rows:
        geocoded = await geocode_locations(client, row["locations"])

        async with pool.acquire() as conn:
            await conn.execute(
                "UPDATE processed_messages SET geocoded_locations = $2 WHERE id = $1",
                row["id"],
                json.dumps(geocoded),
            )

    log.info("geocoding batch complete")
    await pool.close()


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument("--batch-size", type=int, default=50)
    args = parser.parse_args()

    logging.basicConfig(level="INFO")
    asyncio.run(geocode_batch(args.batch_size))
