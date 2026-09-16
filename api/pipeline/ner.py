"""
Extract location entities from translated messages using Gemini Flash via OpenRouter.
Replaces GLiNER2. Updates processed_messages.locations.

Usage:
    python -m pipeline.ner
    python -m pipeline.ner --batch-size 100
"""
import asyncio
import json
import logging

import asyncpg

from modules.dbcreds import resolve_postgres_dsn
from modules.llm import openrouter_client, PIPELINE_MODEL

log = logging.getLogger(__name__)

SYSTEM_PROMPT = """\
Extract location mentions from messages posted by Ukrainian refugees in Poland.
Include: cities, towns, districts, neighborhoods, border crossings, countries,
regions, voivodeships, streets, addresses, institutions with locations.

Respond with JSON: {"locations": ["location name", ...]}
Return an empty list if no locations are mentioned.
Return only the JSON object, no other text."""


async def extract_locations(batch_size: int = 100) -> None:
    client = openrouter_client()
    pool = await asyncpg.create_pool(resolve_postgres_dsn(), min_size=2, max_size=5)

    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT p.id, p.translation
            FROM processed_messages p
            WHERE p.translation IS NOT NULL
              AND p.locations IS NULL
            LIMIT $1
            """,
            batch_size,
        )

    log.info("extracting locations from %d messages", len(rows))

    for row in rows:
        try:
            response = await client.chat.completions.create(
                model=PIPELINE_MODEL,
                max_tokens=256,
                temperature=0,
                response_format={"type": "json_object"},
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": row["translation"]},
                ],
            )
            data = json.loads(response.choices[0].message.content)
            locations = data.get("locations", [])
        except Exception:
            log.exception("NER failed for message %d", row["id"])
            continue

        async with pool.acquire() as conn:
            await conn.execute(
                "UPDATE processed_messages SET locations = $2 WHERE id = $1",
                row["id"],
                locations,
            )

    log.info("NER batch complete")
    await pool.close()


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument("--batch-size", type=int, default=100)
    args = parser.parse_args()

    logging.basicConfig(level="INFO")
    asyncio.run(extract_locations(args.batch_size))
