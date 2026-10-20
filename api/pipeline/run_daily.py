"""
Daily pipeline: scrape every enabled channel, then process everything that is
waiting (translate -> locations -> categorize -> geocode -> media -> embed)
until each stage reports no work left. Prints a JSON summary as the last line.

Usage:
    python -m pipeline.run_daily
    python -m pipeline.run_daily --skip-scrape        # only drain the processing backlog
    python -m pipeline.run_daily --channel foo        # one channel instead of the channels table
"""
from __future__ import annotations

import argparse
import asyncio
import json
import logging
import sys
import time

import asyncpg

from modules.dbcreds import resolve_postgres_dsn
from pipeline.categorizer import categorize_batch
from pipeline.embedder import embed_batch
from pipeline.geocoder import geocode_batch
from pipeline.media_analyzer import analyze_batch
from pipeline.ner import extract_locations
from pipeline.scraper import TelegramNotAuthorized, scrape
from pipeline.translator import translate_batch

log = logging.getLogger("pipeline.run_daily")

# (name, coroutine factory, batch size). Each returns rows picked up; 0 means the stage is drained.
STAGES = [
    ("translate", translate_batch, 50),
    ("locations", extract_locations, 100),
    ("categorize", categorize_batch, 100),
    ("geocode", geocode_batch, 50),
    ("media", analyze_batch, 20),
    ("embed", embed_batch, 200),
]
MAX_BATCHES_PER_STAGE = 200  # hard stop so a stuck stage cannot loop forever


async def enabled_channels(pool: asyncpg.Pool, only: str | None) -> list[str]:
    if only:
        return [only]
    async with pool.acquire() as conn:
        rows = await conn.fetch("SELECT name FROM channels WHERE enabled ORDER BY name")
    return [r["name"] for r in rows]


async def record_scrape(pool: asyncpg.Pool, channel: str) -> None:
    async with pool.acquire() as conn:
        await conn.execute(
            """
            UPDATE channels
               SET last_scraped_at = NOW(),
                   last_message_at = (SELECT MAX(date) FROM messages WHERE channel_name = $1)
             WHERE name = $1
            """,
            channel,
        )


async def drain(name: str, fn, batch_size: int) -> int:
    total = 0
    for _ in range(MAX_BATCHES_PER_STAGE):
        picked = await fn(batch_size)
        total += picked
        if picked < batch_size:
            break
    log.info("stage %s: %d rows", name, total)
    return total


async def main(args: argparse.Namespace) -> int:
    started = time.monotonic()
    summary: dict = {"scraped": {}, "processed": {}, "errors": []}
    pool = await asyncpg.create_pool(resolve_postgres_dsn(), min_size=1, max_size=3)

    if not args.skip_scrape:
        channels = await enabled_channels(pool, args.channel)
        if not channels:
            summary["errors"].append("no enabled channels")
        for channel in channels:
            try:
                inserted = await scrape(channel, limit=args.limit, full=False, no_media=args.no_media)
                summary["scraped"][channel] = inserted
                await record_scrape(pool, channel)
            except TelegramNotAuthorized as exc:
                summary["errors"].append(str(exc))
                break  # every channel would fail the same way
            except Exception as exc:
                log.exception("scrape failed for %s", channel)
                summary["errors"].append(f"{channel}: {exc}")

    for name, fn, batch_size in STAGES:
        try:
            summary["processed"][name] = await drain(name, fn, batch_size)
        except Exception as exc:
            log.exception("stage %s failed", name)
            summary["errors"].append(f"{name}: {exc}")

    async with pool.acquire() as conn:
        summary["newest_message"] = str(await conn.fetchval("SELECT MAX(date) FROM messages"))
        summary["unprocessed"] = await conn.fetchval(
            "SELECT COUNT(*) FROM messages m LEFT JOIN processed_messages p ON p.id = m.id "
            "WHERE p.id IS NULL AND m.raw_text IS NOT NULL AND m.raw_text != ''"
        )
    await pool.close()

    summary["seconds"] = round(time.monotonic() - started, 1)
    print(json.dumps(summary, default=str))
    return 1 if summary["errors"] else 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--channel", help="scrape only this channel (default: every enabled row in `channels`)")
    parser.add_argument("--limit", type=int, default=500, help="max messages per channel per run")
    parser.add_argument("--no-media", action="store_true")
    parser.add_argument("--skip-scrape", action="store_true")
    logging.basicConfig(level="INFO", format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    sys.exit(asyncio.run(main(parser.parse_args())))
