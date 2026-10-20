"""External open-data layers: catalogue, point events, area indicators, per-country summary."""
from __future__ import annotations

import json
from datetime import datetime

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Query

router = APIRouter()


def _get_pool():
    from main import get_pool
    return get_pool()


def _row(r: asyncpg.Record) -> dict:
    d = dict(r)
    for k, v in list(d.items()):
        if isinstance(v, datetime):
            d[k] = v.isoformat()
        elif isinstance(v, str) and k in ("metrics", "extra", "config", "geometry"):
            try:
                d[k] = json.loads(v)
            except ValueError:
                pass
        elif hasattr(v, "isoformat"):
            d[k] = v.isoformat()
    return d


@router.get("/layers")
async def list_layers(pool: asyncpg.Pool = Depends(_get_pool)):
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT slug, name, provider, kind, licence_id, attribution_text, homepage, default_on, cadence,
                   countries, record_count, last_success_at, last_error
            FROM sources WHERE enabled ORDER BY kind, name
            """
        )
    return {"layers": [_row(r) for r in rows]}


@router.get("/layers/summary")
async def layers_summary(iso3: str = Query("UKR,POL,MDA,ROU,SVK,HUN"), pool: asyncpg.Pool = Depends(_get_pool)):
    """Latest headline values per country: one row per (iso3, indicator) at admin0, plus GDACS counts."""
    codes = [c.strip().upper() for c in iso3.split(",") if c.strip()][:12]
    async with pool.acquire() as conn:
        indicators = await conn.fetch(
            """
            SELECT DISTINCT ON (a.iso3, a.indicator, a.extra_key)
                   a.iso3, a.indicator, a.extra_key, a.period_start, a.period_end, a.value, a.value_text, a.extra, s.attribution_text
            FROM area_indicators a JOIN sources s ON s.slug = a.source_slug
            WHERE a.iso3 = ANY($1::text[]) AND a.admin_level = 0
            ORDER BY a.iso3, a.indicator, a.extra_key, a.period_start DESC
            """,
            codes,
        )
        alerts = await conn.fetch(
            """
            SELECT iso3, alert_level, COUNT(*) AS n
            FROM external_events
            WHERE source_slug = 'gdacs' AND iso3 = ANY($1::text[]) AND occurred_at > NOW() - INTERVAL '30 days'
            GROUP BY iso3, alert_level
            """,
            codes,
        )
    return {
        "countries": codes,
        "indicators": [_row(r) for r in indicators],
        "gdacs_last_30d": [_row(r) for r in alerts],
    }


@router.get("/layers/{slug}/events")
async def layer_events(
    slug: str,
    since: str | None = None,
    until: str | None = None,
    bbox: str | None = Query(None, description="minLon,minLat,maxLon,maxLat"),
    limit: int = Query(5000, le=20000),
    pool: asyncpg.Pool = Depends(_get_pool),
):
    clauses = ["source_slug = $1"]
    params: list = [slug]
    if since:
        params.append(datetime.fromisoformat(since)); clauses.append(f"occurred_at >= ${len(params)}")
    if until:
        params.append(datetime.fromisoformat(until)); clauses.append(f"occurred_at <= ${len(params)}")
    if bbox:
        try:
            min_lon, min_lat, max_lon, max_lat = [float(x) for x in bbox.split(",")]
        except ValueError:
            raise HTTPException(400, "bbox must be minLon,minLat,maxLon,maxLat")
        params += [min_lon, max_lon, min_lat, max_lat]
        n = len(params)
        clauses.append(f"lon BETWEEN ${n-3} AND ${n-2} AND lat BETWEEN ${n-1} AND ${n}")
    params.append(limit)
    async with pool.acquire() as conn:
        source = await conn.fetchrow("SELECT slug, name, attribution_text, licence_id, last_success_at FROM sources WHERE slug = $1 AND enabled", slug)
        if not source:
            raise HTTPException(404, "unknown layer")
        rows = await conn.fetch(
            f"""
            SELECT id, source_record_id, event_type, category, title, summary, url, occurred_at, reported_at,
                   lat, lon, precision, iso3, severity, alert_level, metrics
            FROM external_events WHERE {' AND '.join(clauses)}
            ORDER BY occurred_at DESC LIMIT ${len(params)}
            """,
            *params,
        )
    return {"layer": _row(source), "events": [_row(r) for r in rows]}


@router.get("/layers/{slug}/areas")
async def layer_areas(
    slug: str,
    indicator: str,
    iso3: str | None = None,
    period: str = Query("latest", description="'latest' or a period_start date"),
    admin_level: int | None = None,
    pool: asyncpg.Pool = Depends(_get_pool),
):
    clauses = ["a.source_slug = $1", "a.indicator = $2"]
    params: list = [slug, indicator]
    if iso3:
        params.append(iso3.upper()); clauses.append(f"a.iso3 = ${len(params)}")
    if admin_level is not None:
        params.append(admin_level); clauses.append(f"a.admin_level = ${len(params)}")
    if period != "latest":
        params.append(datetime.fromisoformat(period).date()); clauses.append(f"a.period_start = ${len(params)}")
    where = " AND ".join(clauses)
    async with pool.acquire() as conn:
        source = await conn.fetchrow("SELECT slug, name, attribution_text, licence_id, last_success_at FROM sources WHERE slug = $1 AND enabled", slug)
        if not source:
            raise HTTPException(404, "unknown layer")
        rows = await conn.fetch(
            f"""
            SELECT DISTINCT ON (a.pcode, a.extra_key)
                   a.pcode, a.iso3, a.admin_level, a.area_name, a.period_start, a.period_end, a.value, a.value_text, a.extra, a.extra_key,
                   m.name AS admin_name, m.centroid_lat, m.centroid_lon, m.geometry
            FROM area_indicators a LEFT JOIN admin_areas m ON m.pcode = a.pcode
            WHERE {where}
            ORDER BY a.pcode, a.extra_key, a.period_start DESC
            """,
            *params,
        )
    return {"layer": _row(source), "indicator": indicator, "areas": [_row(r) for r in rows]}
