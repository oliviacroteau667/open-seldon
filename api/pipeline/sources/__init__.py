"""Connector framework for external open-data layers (design: docs/open-data-integration.md)."""
from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import random
import time
from dataclasses import dataclass, field
from datetime import date, datetime
from typing import AsyncIterator, Iterable

import httpx

log = logging.getLogger(__name__)

USER_AGENT = "open-seldon/0.1 (+https://github.com/oliviacroteau667/open-seldon)"


@dataclass
class PointEvent:
    source_record_id: str
    title: str
    occurred_at: datetime
    lat: float | None = None
    lon: float | None = None
    event_type: str | None = None
    category: str | None = None
    summary: str | None = None
    url: str | None = None
    reported_at: datetime | None = None
    precision: str | None = None
    iso3: str | None = None
    admin1_code: str | None = None
    admin2_code: str | None = None
    severity: str | None = None
    alert_level: str | None = None
    metrics: dict = field(default_factory=dict)
    raw: dict | None = None
    reference_period_start: date | None = None
    reference_period_end: date | None = None

    def content_hash(self) -> str:
        payload = json.dumps(
            [self.title, self.summary, self.occurred_at.isoformat(), self.lat, self.lon, self.severity, self.alert_level, self.metrics],
            sort_keys=True, default=str,
        )
        return hashlib.sha256(payload.encode()).hexdigest()[:32]


@dataclass
class AreaIndicator:
    indicator: str
    iso3: str
    admin_level: int
    pcode: str
    period_start: date
    value: float | None = None
    value_text: str | None = None
    area_name: str | None = None
    period_end: date | None = None
    extra: dict = field(default_factory=dict)
    extra_key: str = ""


class Connector:
    slug: str = ""
    kind: str = "points"  # points | areas | documents | boundaries

    def __init__(self, http: "Http", config: dict | None = None):
        self.http = http
        self.config = config or {}

    async def fetch(self, since: datetime | None, countries: list[str] | None) -> AsyncIterator[PointEvent | AreaIndicator]:
        raise NotImplementedError
        yield  # pragma: no cover


class Http:
    """Shared async client: project User-Agent, per-host pacing, exponential backoff on 429/5xx."""

    def __init__(self, min_interval: dict[str, float] | None = None, retries: int = 5):
        self.client = httpx.AsyncClient(headers={"User-Agent": USER_AGENT}, timeout=httpx.Timeout(60.0), follow_redirects=True)
        self.min_interval = min_interval or {}
        self.retries = retries
        self._last: dict[str, float] = {}

    async def _pace(self, host: str) -> None:
        gap = self.min_interval.get(host)
        if not gap:
            return
        wait = self._last.get(host, 0) + gap - time.monotonic()
        if wait > 0:
            await asyncio.sleep(wait)
        self._last[host] = time.monotonic()

    async def get(self, url: str, params: dict | None = None, headers: dict | None = None) -> httpx.Response:
        host = httpx.URL(url).host
        delay = 2.0
        for attempt in range(1, self.retries + 1):
            await self._pace(host)
            try:
                resp = await self.client.get(url, params=params, headers=headers)
            except httpx.HTTPError as exc:
                if attempt == self.retries:
                    raise
                log.warning("GET %s failed (%s); retry %d/%d in %.0fs", url, exc, attempt, self.retries, delay)
            else:
                if resp.status_code < 400:
                    return resp
                if resp.status_code not in (429, 500, 502, 503, 504) or attempt == self.retries:
                    resp.raise_for_status()
                retry_after = resp.headers.get("Retry-After")
                if retry_after and retry_after.isdigit():
                    delay = max(delay, float(retry_after))
                log.warning("GET %s -> %d; retry %d/%d in %.0fs", url, resp.status_code, attempt, self.retries, delay)
            await asyncio.sleep(delay + random.uniform(0, 0.5))
            delay = min(delay * 2, 60)
        raise RuntimeError("unreachable")

    async def get_json(self, url: str, params: dict | None = None, headers: dict | None = None):
        return (await self.get(url, params=params, headers=headers)).json()

    async def aclose(self) -> None:
        await self.client.aclose()


def parse_dt(value) -> datetime | None:
    """Lenient ISO-8601 parser for the formats the sources use; naive values are treated as UTC."""
    if value in (None, ""):
        return None
    if isinstance(value, datetime):
        return value
    s = str(value).strip().replace("Z", "+00:00")
    try:
        dt = datetime.fromisoformat(s)
    except ValueError:
        for fmt in ("%d/%b/%Y %H:%M:%S", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d"):
            try:
                dt = datetime.strptime(s, fmt)
                break
            except ValueError:
                continue
        else:
            return None
    if dt.tzinfo is None:
        from datetime import timezone
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def parse_date(value) -> date | None:
    dt = parse_dt(value)
    return dt.date() if dt else None


def chunked(items: Iterable, size: int):
    batch = []
    for item in items:
        batch.append(item)
        if len(batch) >= size:
            yield batch
            batch = []
    if batch:
        yield batch
