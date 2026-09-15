"""
Generate sentence embeddings for translated messages and store in pgvector.
Uses all-MiniLM-L6-v2 (384-dim) — same model as the old system, now stored
in a proper vector column instead of LONGTEXT JSON.
"""
import asyncio
import logging

import asyncpg
from sentence_transformers import SentenceTransformer

from modules.dbcreds import resolve_postgres_dsn

log = logging.getLogger(__name__)

MODEL_NAME = "all-MiniLM-L6-v2"


async def embed_batch(batch_size: int = 200) -> None:
    pool = await asyncpg.create_pool(resolve_postgres_dsn(), min_size=2, max_size=5)
    model = SentenceTransformer(MODEL_NAME)

    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT id, translation
            FROM processed_messages
            WHERE translation IS NOT NULL
              AND embedding IS NULL
            LIMIT $1
            """,
            batch_size,
        )

    if not rows:
        log.info("no messages to embed")
        await pool.close()
        return

    log.info("embedding %d messages", len(rows))
    texts = [row["translation"] for row in rows]
    embeddings = model.encode(texts, show_progress_bar=True, normalize_embeddings=True)

    async with pool.acquire() as conn:
        await conn.executemany(
            "UPDATE processed_messages SET embedding = $2 WHERE id = $1",
            [(row["id"], embedding.tolist()) for row, embedding in zip(rows, embeddings)],
        )

    log.info("embedding batch complete")
    await pool.close()


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument("--batch-size", type=int, default=200)
    args = parser.parse_args()

    logging.basicConfig(level="INFO")
    asyncio.run(embed_batch(args.batch_size))
