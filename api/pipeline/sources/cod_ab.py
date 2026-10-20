"""OCHA Common Operational Dataset – Administrative Boundaries (COD-AB) via HDX. docs/data-sources.md#cod-ab

Loads admin0 + admin1 polygons per country from the `cod-ab-<iso3>` GeoJSON zip (CC BY-IGO),
simplifies them for web display and keeps the COD p-code so area indicators (HAPI, Insecurity
Insight, ...) can be drawn as choropleths. The zip is large (Ukraine ≈ 84 MB) so it is streamed
to a temp file and only the admin0/admin1 members are read.
"""
from __future__ import annotations

import json
import os
import tempfile
import zipfile
from datetime import datetime
from typing import AsyncIterator

from pipeline.sources import AdminArea, Connector, simplify_geometry

CKAN = "https://data.humdata.org/api/3/action/package_show"
LEVELS = (0, 1)


def _prop(props: dict, *names: str):
    for n in names:
        v = props.get(n)
        if v not in (None, ""):
            return v
        v = props.get(n.upper())
        if v not in (None, ""):
            return v
    return None


def _centroid(geom: dict) -> tuple[float | None, float | None]:
    xs, ys = [], []
    polys = geom["coordinates"] if geom["type"] == "MultiPolygon" else [geom["coordinates"]]
    for poly in polys:
        for x, y in poly[0]:
            xs.append(x); ys.append(y)
    if not xs:
        return None, None
    return (min(ys) + max(ys)) / 2, (min(xs) + max(xs)) / 2


def parse_feature(feature: dict, iso3: str, level: int, tol: float = 0.005) -> AdminArea | None:
    props = feature.get("properties") or {}
    geom = feature.get("geometry")
    if not geom:
        return None
    pcode = _prop(props, f"adm{level}_pcode") if level else (_prop(props, "adm0_pcode") or iso3)
    name = _prop(props, f"adm{level}_name", f"adm{level}_en", f"adm{level}_ref_name") if level else _prop(props, "adm0_name", "adm0_en") or iso3
    if not pcode or not name:
        return None
    simplified = simplify_geometry(geom, tol=tol)
    lat, lon = _prop(props, "center_lat"), _prop(props, "center_lon")
    if lat is None or lon is None:
        lat, lon = _centroid(simplified or geom)
    parent = _prop(props, f"adm{level - 1}_pcode") if level else None
    return AdminArea(pcode=str(pcode), iso3=iso3, admin_level=level, name=str(name), parent_pcode=str(parent) if parent else None,
                     centroid_lat=float(lat) if lat is not None else None, centroid_lon=float(lon) if lon is not None else None,
                     geometry=simplified)


class CodAbConnector(Connector):
    slug = "cod_ab"
    kind = "boundaries"

    async def fetch(self, since: datetime | None, countries: list[str] | None) -> AsyncIterator[AdminArea]:
        tol = float(self.config.get("tolerance", 0.005))
        for iso3 in countries or []:
            meta = await self.http.get_json(CKAN, params={"id": f"cod-ab-{iso3.lower()}"})
            resources = (meta.get("result") or {}).get("resources") or []
            res = next((r for r in resources if str(r.get("format", "")).lower() == "geojson"), None)
            if not res:
                continue
            fd, path = tempfile.mkstemp(suffix=".zip")
            try:
                async with self.http.client.stream("GET", res["url"]) as resp:
                    resp.raise_for_status()
                    with os.fdopen(fd, "wb") as out:
                        async for chunk in resp.aiter_bytes(1 << 20):
                            out.write(chunk)
                with zipfile.ZipFile(path) as z:
                    for level in LEVELS:
                        member = next((n for n in z.namelist() if n.lower().endswith(f"admin{level}.geojson")), None)
                        if not member:
                            continue
                        fc = json.loads(z.read(member))
                        for feature in fc.get("features") or []:
                            area = parse_feature(feature, iso3, level, tol)
                            if area:
                                yield area
            finally:
                try:
                    os.unlink(path)
                except OSError:
                    pass
