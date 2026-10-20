"""IDMC Internal Displacement Updates via HDX per-country CSVs. docs/data-sources.md#idmc

HDX publishes `<iso3>-idmc-idu-events` datasets (CC BY-IGO) refreshed daily; the IDMC API itself
needs a key by email. We read the CSV resource and keep IDMC's own event id as the record id.
"""
from __future__ import annotations

import csv
import io
from datetime import datetime
from typing import AsyncIterator

from pipeline.sources import Connector, PointEvent, parse_date, parse_dt

CKAN = "https://data.humdata.org/api/3/action/package_show"


def _num(v):
    try:
        return float(v) if v not in (None, "") else None
    except (TypeError, ValueError):
        return None


def parse_row(row: dict) -> PointEvent | None:
    """One IDU CSV row -> PointEvent. Column names follow IDMC's IDU export."""
    rid = row.get("id") or row.get("ID")
    occurred = parse_dt(row.get("displacement_date") or row.get("displacement_start_date") or row.get("created_at"))
    if not rid or occurred is None:
        return None
    lat, lon = _num(row.get("latitude")), _num(row.get("longitude"))
    figure = _num(row.get("figure"))
    dtype = (row.get("displacement_type") or "").strip() or None
    name = (row.get("event_name") or "").strip()
    place = (row.get("locations_name") or "").strip()
    title = name or f"{dtype or 'Displacement'} — {place or row.get('country') or ''}".strip(" —")
    if figure is not None and name:
        title = f"{name}: {int(figure):,} displaced"
    return PointEvent(
        source_record_id=str(rid),
        title=title[:300],
        summary=(row.get("standard_popup_text") or row.get("description") or None),
        url=(row.get("source_url") or row.get("standard_info_text") or None),
        occurred_at=occurred,
        reported_at=parse_dt(row.get("created_at")),
        lat=lat, lon=lon,
        event_type=dtype,
        category="housing" if (dtype or "").lower() == "disaster" else "safety" if dtype else None,
        precision=(row.get("locations_accuracy") or None),
        iso3=(row.get("iso3") or "").upper() or None,
        severity=f"{int(figure):,} people" if figure is not None else None,
        metrics={"figure": figure, "category": row.get("category"), "subcategory": row.get("subcategory") or row.get("subtype"),
                 "sources": row.get("sources"), "type": row.get("type")},
        raw={k: v for k, v in row.items() if v not in (None, "")},
        reference_period_start=parse_date(row.get("displacement_start_date")),
        reference_period_end=parse_date(row.get("displacement_end_date")),
    )


class IdmcHdxConnector(Connector):
    slug = "idmc_hdx"
    kind = "points"

    async def fetch(self, since: datetime | None, countries: list[str] | None) -> AsyncIterator[PointEvent]:
        for iso3 in countries or []:
            name = f"{iso3.lower()}-idmc-idu-events"
            try:
                meta = await self.http.get_json(CKAN, params={"id": name})
            except Exception as exc:  # a country without an IDU dataset is normal (HDX answers 404)
                if "404" in str(exc):
                    continue
                raise
            resources = (meta.get("result") or {}).get("resources") or []
            csv_res = next((r for r in resources if str(r.get("format", "")).lower() == "csv"), None) or (resources[0] if resources else None)
            if not csv_res:
                continue
            resp = await self.http.get(csv_res["url"])
            text = resp.content.decode("utf-8-sig", errors="replace")
            for row in csv.DictReader(io.StringIO(text)):
                ev = parse_row(row)
                if ev is None:
                    continue
                if since and ev.occurred_at < since and (ev.reported_at is None or ev.reported_at < since):
                    continue
                yield ev
