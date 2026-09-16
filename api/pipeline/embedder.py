"""
Generate sentence embeddings for translated messages and store in pgvector.
Uses fastembed (ONNX) with all-MiniLM-L6-v2 — 384-dim, no torch dependency.

Usage:
    python -m pipeline.embedder
    python -m pipeline.embedder --batch-size 200
"""
import asyncio
import logging

import asyncpg
from fastembed import TextEmbedding

from modules.dbcreds import resolve_postgres_dsn

log = logging.getLogger(__name__)

_model: TextEmbedding | None = None


def get_model() -> TextEmbedding:
    global _model
    if _model is None:
        _model = TextEmbedding("sentence-transformers/all-MiniLM-L6-v2")
    return _model


async def embed_batch(batch_size: int = 200) -> None:
    pool = await asyncpg.create_pool(resolve_postgres_dsn(), min_size=2, max_size=5)

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
    model = get_model()
    texts = [row["translation"] for row in rows]
    embeddings = list(model.embed(texts))

    async with pool.acquire() as conn:
        await conn.executemany(
            "UPDATE processed_messages SET embedding = $2 WHERE id = $1",
            [(row["id"], emb.tolist()) for row, emb in zip(rows, embeddings)],
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
