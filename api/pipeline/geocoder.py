"""
Geocode extracted location strings to lat/lon using Nominatim.
Updates processed_messages.geocoded_locations as [{name, lat, lon, country}].

Uses geopy RateLimiter (1.5s min delay, auto-retry on 429) per Nominatim ToS.
"""
import asyncio
import json
import logging

import asyncpg
from geopy.geocoders import Nominatim
from geopy.extra.rate_limiter import RateLimiter

from modules.dbcreds import resolve_postgres_dsn

log = logging.getLogger(__name__)

geolocator = Nominatim(user_agent="open-seldon-humanitarian-analytics/0.1")
geocode = RateLimiter(
    geolocator.geocode,
    min_delay_seconds=1.5,
    max_retries=3,
    error_wait_seconds=30,
    swallow_exceptions=False,
)


def geocode_location(location: str) -> dict | None:
    """Try Poland then Ukraine; return first hit."""
    if len(location) < 3:
        return None
    for country in ("pl", "ua"):
        try:
            result = geocode(location, country_codes=country, timeout=10)
            if result:
                return {
                    "name": location,
                    "lat": result.latitude,
                    "lon": result.longitude,
                    "country": country,
                }
        except Exception:
            log.warning("geocoder failed for %r in %s", location, country)
    return None


async def geocode_batch(batch_size: int = 50) -> None:
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
        geocoded = []
        for loc in row["locations"]:
            result = geocode_location(loc)
            if result:
                geocoded.append(result)

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
