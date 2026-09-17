"""
Analyst chatbot endpoint — streaming SSE via Claude Sonnet through OpenRouter.

The chat is scoped to the currently filtered message set: the frontend
passes the IDs of in-view messages and the API fetches their translated
text as context before calling the LLM.
"""
from __future__ import annotations
import logging
from typing import AsyncIterator

import asyncpg
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from modules.llm import openrouter_client, CHAT_MODEL

log = logging.getLogger(__name__)
router = APIRouter()


SYSTEM_PROMPT = """\
You are an analyst assistant for IOM (International Organization for Migration) field staff
monitoring Ukrainian refugee Telegram channels in Poland. You help staff understand patterns,
needs, and concerns expressed in the messages.

Answer questions concisely and factually. Cite specific counts, cities, and examples when
relevant. If the context doesn't contain enough information, say so clearly.

Format your responses in plain prose — no markdown headers, minimal bullet points.
Keep answers under 150 words unless the question clearly requires more detail."""


def _get_pool():
    from main import get_pool
    return get_pool()


class ChatRequest(BaseModel):
    message: str
    context_ids: list[int] | None = None


async def _stream_response(message: str, context: str) -> AsyncIterator[str]:
    client = openrouter_client()
    system = f"{SYSTEM_PROMPT}\n\nMessage context (translated):\n{context}"

    stream = await client.chat.completions.create(
        model=CHAT_MODEL,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": message},
        ],
        stream=True,
        max_tokens=400,
    )

    async for chunk in stream:
        delta = chunk.choices[0].delta.content
        if delta:
            yield delta


@router.post("/chat")
async def chat(
    req: ChatRequest,
    pool: asyncpg.Pool = Depends(_get_pool),
):
    if req.context_ids:
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT m.channel_name, m.date, p.translation, p.categories, p.geocoded_locations
                FROM messages m
                JOIN processed_messages p ON m.id = p.id
                WHERE m.id = ANY($1)
                ORDER BY m.date DESC
                LIMIT 150
                """,
                req.context_ids,
            )
        context_lines = []
        for r in rows:
            cats = ", ".join(r["categories"] or [])
            date_str = r["date"].strftime("%d %b %H:%M")
            context_lines.append(
                f"[{r['channel_name']} · {date_str}] ({cats}): {r['translation'] or ''}"
            )
        context = "\n".join(context_lines) or "No messages in current filter."
    else:
        context = "No specific messages selected."

    return StreamingResponse(
        _stream_response(req.message, context),
        media_type="text/plain; charset=utf-8",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Transfer-Encoding": "chunked",
        },
    )


@router.get("/summary")
async def weekly_summary(pool: asyncpg.Pool = Depends(_get_pool)):
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT m.channel_name, m.date, p.translation, p.categories, p.geocoded_locations
            FROM messages m
            JOIN processed_messages p ON m.id = p.id
            WHERE m.date >= NOW() - INTERVAL '7 days'
            ORDER BY m.date DESC
            LIMIT 300
            """
        )

    context_lines = []
    for r in rows:
        cats = ", ".join(r["categories"] or [])
        date_str = r["date"].strftime("%d %b %H:%M")
        context_lines.append(
            f"[{r['channel_name']} · {date_str}] ({cats}): {r['translation'] or ''}"
        )
    context = "\n".join(context_lines) or "No messages this week."

    summary_prompt = (
        "Write a concise weekly situation report for IOM field staff based on the Telegram "
        "messages below. Cover: total volume, top need categories with counts, key geographic "
        "hotspots, and 2-3 notable specific issues. Keep it under 200 words, in plain prose, "
        "no markdown headers."
    )

    async def _stream():
        client = openrouter_client()
        stream = await client.chat.completions.create(
            model=CHAT_MODEL,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": f"{summary_prompt}\n\nMessages:\n{context}"},
            ],
            stream=True,
            max_tokens=500,
        )
        async for chunk in stream:
            delta = chunk.choices[0].delta.content
            if delta:
                yield delta

    return StreamingResponse(
        _stream(),
        media_type="text/plain; charset=utf-8",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
