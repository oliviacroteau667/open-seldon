"""
Classify messages into IOM humanitarian needs taxonomy using Gemini Flash via OpenRouter.
Replaces GLiNER2. Updates processed_messages.categories.

Categories (IOM taxonomy):
    Legal Status / Documentation
    Employment
    Polish Language Proficiency
    Accommodation / Housing
    Education
    Health / Mental Health
    Safety / Security
    Border Crossing

Usage:
    python -m pipeline.categorizer
    python -m pipeline.categorizer --batch-size 100
"""
import asyncio
import json
import logging

import asyncpg

from modules.dbcreds import resolve_postgres_dsn
from modules.llm import openrouter_client, PIPELINE_MODEL

log = logging.getLogger(__name__)

IOM_CATEGORIES = [
    "Legal Status / Documentation",
    "Employment",
    "Polish Language Proficiency",
    "Accommodation / Housing",
    "Education",
    "Health / Mental Health",
    "Safety / Security",
    "Border Crossing",
]

SYSTEM_PROMPT = f"""\
You categorize messages from Ukrainian refugee Telegram channels in Poland for IOM analysts.
Assign zero or more of these categories that apply to the message:
{chr(10).join(f"- {c}" for c in IOM_CATEGORIES)}

Respond with JSON: {{"categories": ["Category Name", ...]}}
Return an empty list if none apply. Use exact category names from the list above.
Return only the JSON object, no other text."""


async def categorize_batch(batch_size: int = 100) -> None:
    client = openrouter_client()
    pool = await asyncpg.create_pool(resolve_postgres_dsn(), min_size=2, max_size=5)

    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT p.id, p.translation
            FROM processed_messages p
            WHERE p.translation IS NOT NULL
              AND p.categories IS NULL
              AND p.curated = FALSE
            LIMIT $1
            """,
            batch_size,
        )

    log.info("categorizing %d messages", len(rows))

    for row in rows:
        try:
            response = await client.chat.completions.create(
                model=PIPELINE_MODEL,
                max_tokens=128,
                temperature=0,
                response_format={"type": "json_object"},
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": row["translation"]},
                ],
            )
            data = json.loads(response.choices[0].message.content)
            categories = [c for c in data.get("categories", []) if c in IOM_CATEGORIES]
        except Exception:
            log.exception("categorization failed for message %d", row["id"])
            continue

        async with pool.acquire() as conn:
            await conn.execute(
                """
                UPDATE processed_messages
                SET categories = $2
                WHERE id = $1 AND curated = FALSE
                """,
                row["id"],
                categories,
            )

    log.info("categorization batch complete")
    await pool.close()


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument("--batch-size", type=int, default=100)
    args = parser.parse_args()

    logging.basicConfig(level="INFO")
    asyncio.run(categorize_batch(args.batch_size))
