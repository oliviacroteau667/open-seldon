"""IOM Missing Migrants Project via the HDX mirror. docs/data-sources.md#iom-missing-migrants-project

Incident-level deaths and disappearances along migration routes (CC BY-IGO on HDX).
The HDX copy is stale (checked 2026-10-21: it holds 2024 only, last modified Aug 2025) and
missingmigrants.iom.int answers 403 to non-browser clients, so until a current export URL is
confirmed the source row's config may set {"resource_url": "..."} to override the HDX resource.
"""
from __future__ import annotations

import csv
import io
from datetime import datetime
from typing import AsyncIterator

from pipeline.sources import Connector, PointEvent, parse_dt

CKAN = "https://data.humdata.org/api/3/action/package_show"
DATASET = "iom-missing-migrants-project-data"


def _num(v):
    try:
        return float(v) if v not in (None, "") else None
    except (TypeError, ValueError):
        return None


def _coords(value: str | None) -> tuple[float | None, float | None]:
    if not value:
        return None, None
    parts = [p.strip() for p in str(value).replace(";", ",").split(",")]
    if len(parts) < 2:
        return None, None
    lat, lon = _num(parts[0]), _num(parts[1])
    if lat is None or lon is None or abs(lat) > 90 or abs(lon) > 180:
        return None, None
    return lat, lon


def parse_row(row: dict) -> PointEvent | None:
    rid = (row.get("web_id") or row.get("Web ID") or "").strip()
    occurred = parse_dt(row.get("reported_date") or row.get("Reported Date"))
    if not rid or occurred is None:
        return None
    lat, lon = _coords(row.get("location_coodinates") or row.get("location_coordinates") or row.get("Coordinates"))
    dead = _num(row.get("number_dead"))
    missing = _num(row.get("number_missing"))
    total = _num(row.get("total_dead_and_missing")) or ((dead or 0) + (missing or 0))
    route = (row.get("migration_route") or "").strip() or None
    country = (row.get("country_of_incident") or "").strip() or None
    cause = (row.get("cause_death") or "").strip() or None
    where = (row.get("location_description") or "").strip()
    title = f"{int(total)} dead or missing" if total else "Incident"
    if route:
        title += f" — {route}"
    elif country:
        title += f" — {country}"
    return PointEvent(
        source_record_id=rid,
        title=title[:300],
        summary=(f"{cause}. " if cause else "") + where[:400] if (cause or where) else None,
        url=(row.get("url") or None),
        occurred_at=occurred,
        lat=lat, lon=lon,
        event_type=cause,
        category="border",
        precision="point" if lat is not None else None,
        iso3=None,
        severity=f"{int(dead or 0)} dead, {int(missing or 0)} missing" if total else None,
        metrics={"dead": dead, "missing": missing, "total": total, "survivors": _num(row.get("number_of_survivors")),
                 "children": _num(row.get("number_of_children")), "route": route, "region": row.get("region"),
                 "country": country, "source": row.get("information_source"), "source_quality": _num(row.get("source_quality"))},
        raw={k: v for k, v in row.items() if v not in (None, "")},
    )


class IomMmpConnector(Connector):
    slug = "iom_mmp"
    kind = "points"

    async def fetch(self, since: datetime | None, countries: list[str] | None) -> AsyncIterator[PointEvent]:
        url = self.config.get("resource_url")
        if not url:
            meta = await self.http.get_json(CKAN, params={"id": DATASET})
            resources = (meta.get("result") or {}).get("resources") or []
            data_res = next((r for r in resources if str(r.get("format", "")).lower() == "csv" and "codebook" not in str(r.get("name", "")).lower()), None)
            if not data_res:
                return
            url = data_res["url"]
        resp = await self.http.get(url)
        text = resp.content.decode("utf-8-sig", errors="replace")
        for row in csv.DictReader(io.StringIO(text)):
            ev = parse_row(row)
            if ev is None:
                continue
            if since and ev.occurred_at < since:
                continue
            yield ev
