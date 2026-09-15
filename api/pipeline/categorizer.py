"""
Classify messages into IOM humanitarian needs taxonomy using GLiNER2.
Updates processed_messages.categories.

Categories (IOM taxonomy):
    Legal Status / Documentation
    Employment
    Polish Language Proficiency
    Accommodation / Housing
    Education
    Health / Mental Health
    Safety / Security
    Border Crossing
"""
import asyncio
import logging

import asyncpg

from modules.dbcreds import resolve_postgres_dsn

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

CONFIDENCE_THRESHOLD = 0.4


def load_model():
    # Lazy import — torch/gliner are heavy
    from gliner import GLiNER
    return GLiNER.from_pretrained("fastino/gliner2-base-v1")


async def categorize_batch(batch_size: int = 100) -> None:
    pool = await asyncpg.create_pool(resolve_postgres_dsn(), min_size=2, max_size=5)
    model = load_model()

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
            entities = model.predict_entities(
                row["translation"],
                IOM_CATEGORIES,
                threshold=CONFIDENCE_THRESHOLD,
            )
            categories = list({e["label"] for e in entities})
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
