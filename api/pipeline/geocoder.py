"""
Geocode extracted location strings to lat/lon using Nominatim.
Updates processed_messages.geocoded_locations as [{name, lat, lon}].

Rate-limited to 1 request/second per Nominatim ToS.
"""
import asyncio
import json
import logging
import time

import asyncpg
from geopy.geocoders import Nominatim
from geopy.exc import GeocoderTimedOut

from modules.dbcreds import resolve_postgres_dsn

log = logging.getLogger(__name__)

geolocator = Nominatim(user_agent="open-seldon-humanitarian-analytics/0.1")


def geocode_location(location: str) -> dict | None:
    """Try to geocode a location string, constrained to Poland and Ukraine."""
    for country in ("pl", "ua"):
        try:
            time.sleep(1.1)
            result = geolocator.geocode(location, country_codes=country, timeout=10)
            if result:
                return {"name": location, "lat": result.latitude, "lon": result.longitude, "country": country}
        except GeocoderTimedOut:
            log.warning("geocoder timeout for: %s", location)
        except Exception:
            log.exception("geocoder error for: %s", location)
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
