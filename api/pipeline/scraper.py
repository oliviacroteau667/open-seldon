"""
Telegram channel scraper using Telethon.
Writes raw messages to the messages table.

Usage:
    python -m pipeline.scraper --channel polska_grupa_informacyjna
    python -m pipeline.scraper --channel polska_grupa_informacyjna --limit 500 --since 2026-01-01
"""
import argparse
import asyncio
import logging
import os
from datetime import datetime

import asyncpg
from telethon import TelegramClient
from telethon.tl.types import MessageMediaPhoto, MessageMediaDocument

from modules.dbcreds import resolve_postgres_dsn

log = logging.getLogger(__name__)


async def scrape(channel: str, limit: int, since: datetime | None) -> None:
    client = TelegramClient(
        "session",
        int(os.environ["TELEGRAM_API_ID"]),
        os.environ["TELEGRAM_API_HASH"],
    )
    pool = await asyncpg.create_pool(resolve_postgres_dsn(), min_size=2, max_size=5)

    await client.start(phone=os.environ["TELEGRAM_PHONE"])
    log.info("connected to Telegram, scraping %s", channel)

    async with pool.acquire() as conn:
        async for msg in client.iter_messages(channel, limit=limit, offset_date=since, reverse=True):
            if msg.text is None and msg.media is None:
                continue

            media_type = "text"
            if isinstance(msg.media, MessageMediaPhoto):
                media_type = "image"
            elif isinstance(msg.media, MessageMediaDocument):
                media_type = "document"

            await conn.execute(
                """
                INSERT INTO messages (id, channel_id, channel_name, date, raw_text, media_type)
                VALUES ($1, $2, $3, $4, $5, $6)
                ON CONFLICT (id) DO NOTHING
                """,
                msg.id,
                str(msg.chat_id),
                channel,
                msg.date,
                msg.text,
                media_type,
            )

    log.info("scrape complete")
    await client.disconnect()
    await pool.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--channel", required=True)
    parser.add_argument("--limit", type=int, default=1000)
    parser.add_argument("--since", type=lambda s: datetime.fromisoformat(s), default=None)
    args = parser.parse_args()

    logging.basicConfig(level="INFO")
    asyncio.run(scrape(args.channel, args.limit, args.since))
