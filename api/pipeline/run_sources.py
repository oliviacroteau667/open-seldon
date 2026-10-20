"""
Nightly runner for external open-data connectors (GDACS, HDX HAPI, ...).

Runs every enabled row of `sources` whose cadence is due, upserts what each connector
yields, records a `source_runs` row and prints a JSON summary as the last line.
One source failing never aborts the run.

Usage:
    python -m pipeline.run_sources
    python -m pipeline.run_sources --source gdacs --since 2026-01-01
    python -m pipeline.run_sources --source hapi --sample      # print a few parsed rows, no writes
"""
from __future__ import annotations

import argparse
import asyncio
import json
import logging
import sys
import time
from datetime import datetime, timedelta, timezone

import asyncpg

from modules.dbcreds import resolve_postgres_dsn
from pipeline.sources import AreaIndicator, Http, PointEvent, chunked
from pipeline.sources.gdacs import GdacsConnector
from pipeline.sources.hapi import HapiConnector
from pipeline.sources.idmc_hdx import IdmcHdxConnector
from pipeline.sources.iom_mmp import IomMmpConnector

log = logging.getLogger("pipeline.run_sources")

CONNECTORS = {c.slug: c for c in (GdacsConnector, HapiConnector, IdmcHdxConnector, IomMmpConnector)}
MIN_INTERVAL = {"hapi.humdata.org": 1.0, "www.gdacs.org": 0.3, "data.humdata.org": 0.5}
BATCH = 500


async def upsert_points(conn: asyncpg.Connection, slug: str, rows: list[PointEvent]) -> int:
    await conn.executemany(
        """
        INSERT INTO external_events (source_slug, source_record_id, event_type, category, title, summary, url,
            occurred_at, reported_at, lat, lon, precision, iso3, admin1_code, admin2_code, severity, alert_level,
            metrics, raw, content_hash, fetched_at, reference_period_start, reference_period_end)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18::jsonb,$19::jsonb,$20,NOW(),$21,$22)
        ON CONFLICT (source_slug, source_record_id) DO UPDATE SET
            event_type = EXCLUDED.event_type, category = EXCLUDED.category, title = EXCLUDED.title,
            summary = EXCLUDED.summary, url = EXCLUDED.url, occurred_at = EXCLUDED.occurred_at,
            reported_at = EXCLUDED.reported_at, lat = EXCLUDED.lat, lon = EXCLUDED.lon, precision = EXCLUDED.precision,
            iso3 = EXCLUDED.iso3, admin1_code = EXCLUDED.admin1_code, admin2_code = EXCLUDED.admin2_code,
            severity = EXCLUDED.severity, alert_level = EXCLUDED.alert_level, metrics = EXCLUDED.metrics,
            raw = EXCLUDED.raw, content_hash = EXCLUDED.content_hash, fetched_at = NOW(),
            reference_period_start = EXCLUDED.reference_period_start, reference_period_end = EXCLUDED.reference_period_end
        """,
        [
            (slug, r.source_record_id, r.event_type, r.category, r.title, r.summary, r.url, r.occurred_at, r.reported_at,
             r.lat, r.lon, r.precision, r.iso3, r.admin1_code, r.admin2_code, r.severity, r.alert_level,
             json.dumps(r.metrics, default=str), json.dumps(r.raw, default=str) if r.raw is not None else None,
             r.content_hash(), r.reference_period_start, r.reference_period_end)
            for r in rows
        ],
    )
    return len(rows)


async def upsert_areas(conn: asyncpg.Connection, slug: str, rows: list[AreaIndicator]) -> int:
    await conn.executemany(
        """
        INSERT INTO area_indicators (source_slug, indicator, iso3, admin_level, pcode, area_name, period_start, period_end,
            value, value_text, extra, extra_key, fetched_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12,NOW())
        ON CONFLICT (source_slug, indicator, pcode, period_start, extra_key) DO UPDATE SET
            iso3 = EXCLUDED.iso3, admin_level = EXCLUDED.admin_level, area_name = EXCLUDED.area_name,
            period_end = EXCLUDED.period_end, value = EXCLUDED.value, value_text = EXCLUDED.value_text,
            extra = EXCLUDED.extra, fetched_at = NOW()
        """,
        [
            (slug, r.indicator, r.iso3, r.admin_level, r.pcode, r.area_name, r.period_start, r.period_end,
             r.value, r.value_text, json.dumps(r.extra, default=str), r.extra_key)
            for r in rows
        ],
    )
    return len(rows)


async def run_source(pool: asyncpg.Pool, http: Http, source: asyncpg.Record, since_override: datetime | None, sample: bool) -> dict:
    slug = source["slug"]
    cls = CONNECTORS.get(slug)
    result = {"slug": slug, "seen": 0, "upserted": 0, "ok": False, "error": None}
    if cls is None:
        result["error"] = "no connector implemented"
        return result
    cfg = source["config"]
    if isinstance(cfg, str):  # asyncpg hands JSONB back as text unless a codec is registered
        cfg = json.loads(cfg)
    connector = cls(http, dict(cfg or {}))
    since = since_override or source["last_success_at"]
    countries = list(source["countries"]) if source["countries"] else None
    started = datetime.now(timezone.utc)
    run_id = None
    if not sample:
        async with pool.acquire() as conn:
            run_id = await conn.fetchval(
                "INSERT INTO source_runs (source_slug, started_at) VALUES ($1, $2) RETURNING id", slug, started)
            await conn.execute("UPDATE sources SET last_run_at = $2 WHERE slug = $1", slug, started)
    try:
        batch: list = []
        async for rec in connector.fetch(since, countries):
            result["seen"] += 1
            if sample:
                if result["seen"] <= 5:
                    print(json.dumps(rec.__dict__, default=str)[:600])
                if result["seen"] >= 50:
                    break
                continue
            batch.append(rec)
            if len(batch) >= BATCH:
                result["upserted"] += await _flush(pool, slug, batch)
                batch = []
        if batch and not sample:
            result["upserted"] += await _flush(pool, slug, batch)
        result["ok"] = True
    except Exception as exc:  # one source must never sink the run
        log.exception("source %s failed", slug)
        result["error"] = f"{type(exc).__name__}: {exc}"[:500]
    finally:
        if not sample:
            async with pool.acquire() as conn:
                count = await conn.fetchval(
                    "SELECT COUNT(*) FROM external_events WHERE source_slug = $1" if cls.kind == "points"
                    else "SELECT COUNT(*) FROM area_indicators WHERE source_slug = $1", slug)
                await conn.execute(
                    "UPDATE source_runs SET finished_at = NOW(), ok = $2, records_seen = $3, records_upserted = $4, error = $5 WHERE id = $1",
                    run_id, result["ok"], result["seen"], result["upserted"], result["error"])
                if result["ok"]:
                    await conn.execute(
                        "UPDATE sources SET last_success_at = NOW(), last_error = NULL, record_count = $2 WHERE slug = $1", slug, count)
                else:
                    await conn.execute("UPDATE sources SET last_error = $2, record_count = $3 WHERE slug = $1", slug, result["error"], count)
    return result


async def _flush(pool: asyncpg.Pool, slug: str, batch: list) -> int:
    async with pool.acquire() as conn:
        async with conn.transaction():
            if isinstance(batch[0], PointEvent):
                return await upsert_points(conn, slug, batch)
            return await upsert_areas(conn, slug, batch)


def due(source: asyncpg.Record, force: bool) -> bool:
    if force or source["last_success_at"] is None:
        return True
    if source["cadence"] == "weekly":
        return source["last_success_at"] < datetime.now(timezone.utc) - timedelta(days=6)
    return True


async def main(args: argparse.Namespace) -> int:
    started = time.monotonic()
    pool = await asyncpg.create_pool(resolve_postgres_dsn(), min_size=1, max_size=3)
    http = Http(min_interval=MIN_INTERVAL)
    summary: dict = {"sources": [], "errors": []}
    try:
        async with pool.acquire() as conn:
            if args.source:
                sources = await conn.fetch("SELECT * FROM sources WHERE slug = $1", args.source)
            else:
                sources = await conn.fetch("SELECT * FROM sources WHERE enabled ORDER BY slug")
        since = datetime.fromisoformat(args.since).replace(tzinfo=timezone.utc) if args.since else None
        for source in sources:
            if not due(source, force=bool(args.source)):
                summary["sources"].append({"slug": source["slug"], "skipped": "not due"})
                continue
            result = await run_source(pool, http, source, since, args.sample)
            summary["sources"].append(result)
            if result["error"]:
                summary["errors"].append(f"{result['slug']}: {result['error']}")
    finally:
        await http.aclose()
        await pool.close()
    summary["seconds"] = round(time.monotonic() - started, 1)
    print(json.dumps(summary, default=str))
    all_failed = summary["sources"] and all(s.get("error") for s in summary["sources"])
    return 1 if all_failed else 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", help="run one source regardless of cadence")
    parser.add_argument("--since", help="ISO date to backfill from (overrides last_success_at)")
    parser.add_argument("--sample", action="store_true", help="fetch a few records, print them, write nothing")
    logging.basicConfig(level="INFO", format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    sys.exit(asyncio.run(main(parser.parse_args())))
