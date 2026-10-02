"""
Backfill reply_to_id on existing messages without running any processing pipeline.

Usage:
    python -m pipeline.backfill_reply_to --channel polska_grupa_informacyjna
    python -m pipeline.backfill_reply_to --channel polska_grupa_informacyjna --limit 10000
"""
import argparse
import asyncio
import logging
import os
from pathlib import Path

import asyncpg
from telethon import TelegramClient

from modules.dbcreds import resolve_postgres_dsn

log = logging.getLogger(__name__)

SESSION_PATH = os.environ.get("TELEGRAM_SESSION", "/app/session")


async def backfill(channel: str, limit: int) -> None:
    Path(SESSION_PATH).parent.mkdir(parents=True, exist_ok=True)
    client = TelegramClient(
        SESSION_PATH,
        int(os.environ["TELEGRAM_API_ID"]),
        os.environ["TELEGRAM_API_HASH"],
    )
    pool = await asyncpg.create_pool(resolve_postgres_dsn(), min_size=2, max_size=5)

    await client.start(phone=os.environ["TELEGRAM_PHONE"])
    log.info("connected to Telegram, backfilling reply_to_id for %s (limit=%d)", channel, limit)

    updated = 0
    async with pool.acquire() as conn:
        async for msg in client.iter_messages(channel, limit=limit):
            reply_to_id = None
            if msg.reply_to and hasattr(msg.reply_to, "reply_to_msg_id"):
                reply_to_id = msg.reply_to.reply_to_msg_id

            result = await conn.execute(
                """
                UPDATE messages SET reply_to_id = $1
                WHERE id = $2 AND channel_name = $3
                """,
                reply_to_id,
                msg.id,
                channel,
            )
            if result == "UPDATE 1":
                updated += 1

    log.info("done — updated %d rows", updated)
    await client.disconnect()
    await pool.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--channel", required=True)
    parser.add_argument("--limit", type=int, default=10000,
                        help="max messages to fetch from Telegram (default 10000)")
    args = parser.parse_args()

    logging.basicConfig(level="INFO")
    asyncio.run(backfill(args.channel, args.limit))
