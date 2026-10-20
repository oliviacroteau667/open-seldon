"""
Telegram channel scraper using Telethon.
Writes raw messages to the messages table, downloads media to MEDIA_DIR.

Incremental by default: only fetches messages newer than the most recent
already in the database for that channel. First run fetches the latest --limit messages.

Usage:
    python -m pipeline.scraper --channel polska_grupa_informacyjna
    python -m pipeline.scraper --channel polska_grupa_informacyjna --limit 500
    python -m pipeline.scraper --channel polska_grupa_informacyjna --full  # ignore incremental
    python -m pipeline.scraper --channel polska_grupa_informacyjna --no-media  # skip file downloads
"""
import argparse
import asyncio
import logging
import os
import sys
from pathlib import Path

import asyncpg
from telethon import TelegramClient
from telethon.tl.types import MessageMediaPhoto, MessageMediaDocument, MessageMediaWebPage

from modules.dbcreds import resolve_postgres_dsn

log = logging.getLogger(__name__)

MEDIA_DIR = Path(os.environ.get("MEDIA_DIR", "/app/media"))
SESSION_PATH = os.environ.get("TELEGRAM_SESSION", "/app/session")


def media_type_for(msg) -> str:
    if isinstance(msg.media, MessageMediaPhoto):
        return "image"
    if isinstance(msg.media, MessageMediaDocument):
        mime = getattr(msg.media.document, "mime_type", "") or ""
        if mime.startswith("video"):
            return "video"
        if mime.startswith("audio"):
            return "audio"
        return "document"
    if isinstance(msg.media, MessageMediaWebPage):
        return "webpage"
    return "text"


class TelegramNotAuthorized(RuntimeError):
    """The saved session is missing or expired and no terminal is attached to log in."""


async def connect_client() -> TelegramClient:
    Path(SESSION_PATH).parent.mkdir(parents=True, exist_ok=True)
    client = TelegramClient(
        SESSION_PATH,
        int(os.environ["TELEGRAM_API_ID"]),
        os.environ["TELEGRAM_API_HASH"],
    )
    await client.connect()
    if await client.is_user_authorized():
        return client
    if sys.stdin.isatty():
        # Interactive first-time login: Telethon prompts for the code sent to the phone
        await client.start(phone=os.environ["TELEGRAM_PHONE"])
        return client
    await client.disconnect()
    raise TelegramNotAuthorized(
        "Telegram session is not authorized; run `python -m pipeline.scraper --channel <name>` "
        "interactively once to log in"
    )


async def scrape(channel: str, limit: int, full: bool, no_media: bool = False) -> int:
    """Scrape one channel and return the number of newly inserted messages."""
    if not no_media:
        MEDIA_DIR.mkdir(parents=True, exist_ok=True)

    client = await connect_client()
    pool = await asyncpg.create_pool(resolve_postgres_dsn(), min_size=2, max_size=5)
    log.info("connected to Telegram, scraping %s", channel)

    # Incremental: only fetch messages newer than what we already have
    min_id = 0
    if not full:
        async with pool.acquire() as conn:
            min_id = await conn.fetchval(
                "SELECT COALESCE(MAX(id), 0) FROM messages WHERE channel_name = $1",
                channel,
            )
        if min_id:
            log.info("incremental mode: fetching messages newer than id %d", min_id)
        else:
            log.info("no existing messages, fetching latest %d", limit)

    inserted = 0
    async with pool.acquire() as conn:
        async for msg in client.iter_messages(channel, limit=limit, min_id=min_id):
            mtype = media_type_for(msg)
            media_path = None

            # Download photos and videos
            if not no_media and mtype in ("image", "video") and msg.media:
                ext = "jpg" if mtype == "image" else "mp4"
                dest = MEDIA_DIR / channel / f"{msg.id}.{ext}"
                dest.parent.mkdir(parents=True, exist_ok=True)
                try:
                    await client.download_media(msg, file=str(dest))
                    media_path = str(dest)
                except Exception:
                    log.warning("failed to download media for message %d", msg.id)

            reply_to_id = None
            if msg.reply_to and hasattr(msg.reply_to, "reply_to_msg_id"):
                reply_to_id = msg.reply_to.reply_to_msg_id

            result = await conn.execute(
                """
                INSERT INTO messages (id, channel_id, channel_name, date, raw_text, media_type, media_path, reply_to_id)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                ON CONFLICT (id) DO UPDATE SET reply_to_id = EXCLUDED.reply_to_id
                """,
                msg.id,
                str(msg.chat_id),
                channel,
                msg.date,
                msg.text,
                mtype,
                media_path,
                reply_to_id,
            )
            if result == "INSERT 0 1":
                inserted += 1

    log.info("scrape complete — %d new messages inserted", inserted)
    await client.disconnect()
    await pool.close()
    return inserted


async def scrape_and_process(channel: str, limit: int, full: bool, no_media: bool) -> None:
    """CLI behaviour: scrape one channel, then process whatever it brought in."""
    inserted = await scrape(channel, limit, full, no_media)
    if inserted == 0:
        log.info("no new messages — skipping pipeline")
        return

    log.info("running processing pipeline on %d new messages", inserted)
    from pipeline.translator import translate_batch
    from pipeline.ner import extract_locations
    from pipeline.geocoder import geocode_batch
    from pipeline.categorizer import categorize_batch
    from pipeline.embedder import embed_batch

    await translate_batch(batch_size=1000)
    await extract_locations(batch_size=1000)
    await geocode_batch(batch_size=1000)
    await categorize_batch(batch_size=1000)
    await embed_batch(batch_size=1000)
    log.info("pipeline complete")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--channel", required=True)
    parser.add_argument("--limit", type=int, default=100,
                        help="max messages to fetch (first run or --full only)")
    parser.add_argument("--full", action="store_true",
                        help="ignore incremental mode, fetch from scratch")
    parser.add_argument("--no-media", action="store_true",
                        help="skip media downloads, store only text and media_type")
    args = parser.parse_args()

    logging.basicConfig(level="INFO")
    asyncio.run(scrape_and_process(args.channel, args.limit, args.full, args.no_media))
