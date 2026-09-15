"""
Translate raw messages to English using Claude.
Updates processed_messages with detected_language and translation.

Replaces the old Ollama/gemma3 approach with Claude claude-haiku-4-5-20251001 for cost efficiency.
"""
import asyncio
import json
import logging

import anthropic
import asyncpg

from modules.dbcreds import resolve_postgres_dsn

log = logging.getLogger(__name__)

SYSTEM_PROMPT = """\
You are a precise translator for humanitarian data analysis. Given a message, return JSON with two fields:
- "language": ISO 639-1 language code of the original (e.g. "uk", "pl", "ru", "en")
- "translation": a faithful, literal English translation of the message

If the message is already in English, return the original as-is in "translation".
Return only the JSON object, no other text."""


async def translate_batch(batch_size: int = 50) -> None:
    client = anthropic.AsyncAnthropic()
    pool = await asyncpg.create_pool(resolve_postgres_dsn(), min_size=2, max_size=5)

    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT m.id, m.raw_text
            FROM messages m
            LEFT JOIN processed_messages p ON m.id = p.id
            WHERE m.raw_text IS NOT NULL
              AND (p.id IS NULL OR p.translation IS NULL)
            LIMIT $1
            """,
            batch_size,
        )

    log.info("translating %d messages", len(rows))

    for row in rows:
        try:
            response = await client.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=1024,
                system=SYSTEM_PROMPT,
                messages=[{"role": "user", "content": row["raw_text"]}],
            )
            result = json.loads(response.content[0].text)
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
