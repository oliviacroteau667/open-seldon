"""
Analyze images and videos from scraped messages using Gemini Flash vision via OpenRouter.

- Images: encoded and sent directly as base64 image_url
- Videos: a single frame is extracted at the midpoint using ffmpeg,
  then sent for analysis
- Audio/documents: skipped

Updates processed_messages.media_description.

Usage:
    python -m pipeline.media_analyzer --batch-size 20
"""
import asyncio
import base64
import logging
import subprocess
import tempfile
from pathlib import Path

import asyncpg

from modules.dbcreds import resolve_postgres_dsn
from modules.llm import openrouter_client, PIPELINE_MODEL

log = logging.getLogger(__name__)

SYSTEM_PROMPT = """\
You are analyzing media from a Telegram channel used by Ukrainian refugees in Poland.
Describe what you see clearly and factually. Focus on:
- People, locations, documents, or signs visible
- Any text visible in the image (translate to English if in Ukrainian, Polish, or Russian)
- Context relevant to refugee needs (housing, borders, documents, services)

Be concise — 2-4 sentences maximum."""


def extract_video_frame(video_path: str) -> bytes | None:
    """Extract a single frame from the video midpoint using ffmpeg."""
    try:
        probe = subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration",
             "-of", "default=noprint_wrappers=1:nokey=1", video_path],
            capture_output=True, text=True, timeout=15
        )
        duration = float(probe.stdout.strip() or "0")
        seek = max(0, duration / 2)

        with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tmp:
            subprocess.run(
                ["ffmpeg", "-ss", str(seek), "-i", video_path,
                 "-frames:v", "1", "-q:v", "2", "-y", tmp.name],
                capture_output=True, timeout=30, check=True
            )
            return Path(tmp.name).read_bytes()
    except Exception:
        log.warning("ffmpeg frame extraction failed for %s", video_path)
        return None


async def analyze_media(media_path: str, media_type: str) -> str | None:
    image_bytes = None

    if media_type == "image":
        try:
            image_bytes = Path(media_path).read_bytes()
        except Exception:
            log.warning("could not read image at %s", media_path)
            return None
    elif media_type == "video":
        image_bytes = extract_video_frame(media_path)
        if not image_bytes:
            return "Video file — frame extraction failed."
    else:
        return None

    b64 = base64.standard_b64encode(image_bytes).decode()
    client = openrouter_client()
    try:
        response = await client.chat.completions.create(
            model=PIPELINE_MODEL,
            max_tokens=512,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image_url",
                            "image_url": {"url": f"data:image/jpeg;base64,{b64}"},
                        },
                        {
                            "type": "text",
                            "text": "Describe this image from a refugee community Telegram channel.",
                        },
                    ],
                },
            ],
        )
        return response.choices[0].message.content
    except Exception:
        log.exception("vision analysis failed for %s", media_path)
        return None


async def analyze_batch(batch_size: int = 20) -> None:
    pool = await asyncpg.create_pool(resolve_postgres_dsn(), min_size=2, max_size=5)

    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT m.id, m.media_type, m.media_path
            FROM messages m
            LEFT JOIN processed_messages p ON m.id = p.id
            WHERE m.media_type IN ('image', 'video')
              AND m.media_path IS NOT NULL
              AND (p.id IS NULL OR p.media_description IS NULL)
            LIMIT $1
            """,
            batch_size,
        )

    log.info("analyzing media for %d messages", len(rows))

    for row in rows:
        description = await analyze_media(row["media_path"], row["media_type"])
        if description is None:
            continue

        async with pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO processed_messages (id, media_description)
                VALUES ($1, $2)
                ON CONFLICT (id) DO UPDATE
                  SET media_description = EXCLUDED.media_description
                """,
                row["id"],
                description,
            )
        log.info("analyzed message %d", row["id"])

    log.info("media analysis batch complete")
    await pool.close()


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument("--batch-size", type=int, default=20)
    args = parser.parse_args()

    logging.basicConfig(level="INFO")
    asyncio.run(analyze_batch(args.batch_size))
