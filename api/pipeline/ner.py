"""
Extract location entities from translated messages using GLiNER2.
Updates processed_messages.locations.
"""
import asyncio
import logging

import asyncpg

from modules.dbcreds import resolve_postgres_dsn

log = logging.getLogger(__name__)

LOCATION_TYPES = [
    "city", "street", "district", "neighborhood",
    "voivodeship", "postal code", "border crossing",
    "country", "region", "county", "village", "address",
]

CONFIDENCE_THRESHOLD = 0.3


def load_model():
    from gliner import GLiNER
    return GLiNER.from_pretrained("fastino/gliner2-large-v1")


async def extract_locations(batch_size: int = 100) -> None:
    pool = await asyncpg.create_pool(resolve_postgres_dsn(), min_size=2, max_size=5)
    model = load_model()

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
            entities = model.predict_entities(
                row["translation"],
                LOCATION_TYPES,
                threshold=CONFIDENCE_THRESHOLD,
            )
            locations = list({e["text"] for e in entities})
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
