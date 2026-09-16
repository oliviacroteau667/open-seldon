"""
Translate raw messages to English using Gemini Flash via OpenRouter.
Updates processed_messages with detected_language and translation.

Usage:
    python -m pipeline.translator
    python -m pipeline.translator --batch-size 100
"""
import asyncio
import json
import logging

import asyncpg

from modules.dbcreds import resolve_postgres_dsn
from modules.llm import openrouter_client, PIPELINE_MODEL

log = logging.getLogger(__name__)

SYSTEM_PROMPT = """\
Detect the language of the input text and translate it to English.
Respond with JSON: {"language": "<ISO 639-1 code>", "translation": "<English text>"}
If the text is already English, return the original as translation.
If the text is empty or non-linguistic, return {"language": "und", "translation": ""}
Return only the JSON object, no other text."""


async def translate_batch(batch_size: int = 50) -> None:
    client = openrouter_client()
    pool = await asyncpg.create_pool(resolve_postgres_dsn(), min_size=2, max_size=5)

    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT m.id, m.raw_text
            FROM messages m
            LEFT JOIN processed_messages p ON m.id = p.id
            WHERE m.raw_text IS NOT NULL AND m.raw_text != ''
              AND (p.id IS NULL OR p.translation IS NULL)
            LIMIT $1
            """,
            batch_size,
        )

    log.info("translating %d messages", len(rows))

    for row in rows:
        try:
            response = await client.chat.completions.create(
                model=PIPELINE_MODEL,
                max_tokens=1024,
                temperature=0,
                response_format={"type": "json_object"},
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": row["raw_text"]},
                ],
            )
            result = json.loads(response.choices[0].message.content)
        except Exception:
            log.exception("translation failed for message %d", row["id"])
            continue

        async with pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO processed_messages (id, detected_language, translation)
                VALUES ($1, $2, $3)
                ON CONFLICT (id) DO UPDATE
                  SET detected_language = EXCLUDED.detected_language,
                      translation = EXCLUDED.translation
                """,
                row["id"],
                result.get("language"),
                result.get("translation"),
            )

    log.info("translation batch complete")
    await pool.close()


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument("--batch-size", type=int, default=50)
    args = parser.parse_args()

    logging.basicConfig(level="INFO")
    asyncio.run(translate_batch(args.batch_size))
