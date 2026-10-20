"""GDACS disaster alerts (UN OCHA / EC JRC). No auth. docs/data-sources.md#gdacs"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import AsyncIterator

from pipeline.sources import Connector, PointEvent, parse_dt

API = "https://www.gdacs.org/gdacsapi/api/events/geteventlist"
EVENT_TYPES = "EQ;TC;FL;VO;DR;WF"
ALERT_LEVELS = "Green;Orange;Red"
TYPE_NAMES = {"EQ": "Earthquake", "TC": "Tropical cyclone", "FL": "Flood", "VO": "Volcano", "DR": "Drought", "WF": "Wildfire"}
BACKFILL_DAYS = 90


def parse_feature(feature: dict) -> PointEvent | None:
    """One GDACS GeoJSON feature -> PointEvent; returns None when the record is unusable."""
    p = feature.get("properties") or {}
    geom = feature.get("geometry") or {}
    coords = geom.get("coordinates") if geom.get("type") == "Point" else None
    lon, lat = (coords[0], coords[1]) if coords and len(coords) >= 2 else (None, None)
    event_type = str(p.get("eventtype") or "").upper() or None
    event_id = p.get("eventid")
    if event_id is None or not event_type:
        return None
    episode = p.get("episodeid")
    occurred = parse_dt(p.get("fromdate")) or parse_dt(p.get("datemodified"))
    if occurred is None:
        return None
    sev = p.get("severitydata") or {}
    severity = sev.get("severitytext") or (f"{sev.get('severity')} {sev.get('severityunit') or ''}".strip() if sev.get("severity") is not None else None)
    urls = p.get("url") or {}
    countries = p.get("affectedcountries") or []
    affected = [c.get("iso3") for c in countries if isinstance(c, dict) and c.get("iso3")]
    iso3 = (p.get("iso3") or (affected[0] if affected else None) or None)
    title = p.get("name") or p.get("eventname") or f"{TYPE_NAMES.get(event_type, event_type)} {event_id}"
    if event_type and not str(title).lower().startswith(TYPE_NAMES.get(event_type, "").lower()):
        title = f"{TYPE_NAMES.get(event_type, event_type)} — {title}"
    return PointEvent(
        source_record_id=f"{event_type}-{event_id}",
        title=str(title)[:300],
        summary=(p.get("description") or None),
        url=urls.get("report") or urls.get("details") or f"https://www.gdacs.org/report.aspx?eventid={event_id}&eventtype={event_type}",
        occurred_at=occurred,
        reported_at=parse_dt(p.get("datemodified")),
        lat=lat, lon=lon,
        event_type=event_type,
        precision="point",
        iso3=str(iso3).upper() if iso3 else None,
        severity=severity,
        alert_level=(str(p.get("alertlevel") or p.get("episodealertlevel") or "").lower() or None),
        metrics={
            "alert_score": p.get("alertscore"),
            "episode_id": episode,
            "affected_iso3": affected,
            "is_current": p.get("iscurrent"),
            "to_date": p.get("todate"),
            "source": p.get("source"),
        },
        raw=p,
    )


class GdacsConnector(Connector):
    slug = "gdacs"
    kind = "points"

    async def fetch(self, since: datetime | None, countries: list[str] | None) -> AsyncIterator[PointEvent]:
        now = datetime.now(timezone.utc)
        if since is None:
            since = now - timedelta(days=BACKFILL_DAYS)
        # The search endpoint pages through everything in the window; `latest` only reports
        # modifications, so a time-windowed search keeps the first run and incremental runs identical.
        page = 1
        seen: set[str] = set()
        while True:
            data = await self.http.get_json(
                f"{API}/SEARCH",
                params={
                    "eventlist": EVENT_TYPES,
                    "alertlevel": ALERT_LEVELS,
                    "fromDate": since.strftime("%Y-%m-%d"),
                    "toDate": now.strftime("%Y-%m-%d"),
                    "pageSize": 100,
                    "pageNumber": page,
                },
            )
            features = data.get("features") or []
            for f in features:
                ev = parse_feature(f)
                if ev and ev.source_record_id not in seen:
                    seen.add(ev.source_record_id)
                    yield ev
            if len(features) < 100 or page >= 50:
                break
            page += 1
