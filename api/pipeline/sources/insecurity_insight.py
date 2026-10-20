"""Insecurity Insight incident data via HDX. docs/data-sources.md#insecurity-insight

Attacks on health care, aid workers, education and explosive-weapon incidents. For Ukraine every
row's coordinates are censored ("Geo Precision: censored") and only the oblast is given, so this is
an *areas* connector: incidents are counted per oblast per month (admin1, keyed by the OCHA COD
p-code) with a national rollup at admin0. Licence CC BY-SA 4.0 — attribute "Insecurity Insight via HDX".
"""
from __future__ import annotations

import io
import re
from collections import defaultdict
from datetime import date, datetime
from typing import AsyncIterator, Iterable

from pipeline.sources import AreaIndicator, Connector, parse_dt

CKAN = "https://data.humdata.org/api/3/action/package_show"

# HDX dataset per country and which XLSX resources (matched by name) map to which theme
DATASETS = {
    "UKR": "ukraine-data-on-attacks-on-aid-operations-education-health-and-protection",
}
THEMES = {  # theme -> substring of the resource name on HDX
    "health": "attacks on health care incident data",
    "aid": "aid worker kika incident data",
    "education": "education in danger incident data",
    "explosive": "explosive weapons incident data",
}

# Ukraine admin1 p-codes (OCHA COD-AB). Names are matched loosely (oblast / region / transliteration).
UA_ADMIN1 = {
    "crimea": "UA01", "avtonomna respublika krym": "UA01", "vinnyts": "UA05", "volyn": "UA07", "dnipropetrovs": "UA12",
    "donets": "UA14", "zhytomyr": "UA18", "zakarpat": "UA21", "zaporiz": "UA23", "ivano-frankivs": "UA26",
    "kyiv city": "UA80", "kyivska": "UA32", "kyiv oblast": "UA32", "kyiv": "UA32", "kirovohrad": "UA35", "luhans": "UA44",
    "lviv": "UA46", "mykolaiv": "UA48", "odes": "UA51", "poltav": "UA53", "rivne": "UA56", "sumy": "UA59", "sums": "UA59",
    "ternopil": "UA61", "kharkiv": "UA63", "kherson": "UA65", "khmelnyts": "UA68", "cherkas": "UA71", "chernivts": "UA73",
    "chernihiv": "UA74", "sevastopol": "UA85",
    # Kyiv city districts appear in the Admin 1 column for the capital
    "holosiiv": "UA80", "darnyts": "UA80", "desnians": "UA80", "dniprovs": "UA80", "obolons": "UA80", "pechers": "UA80",
    "podils": "UA80", "sviatoshyn": "UA80", "solomians": "UA80", "shevchenkivs": "UA80",
    "beryslav": "UA65",
}


def admin1_pcode(iso3: str, name: str | None) -> str | None:
    if iso3 != "UKR" or not name:
        return None
    n = re.sub(r"\s+", " ", name.strip().lower())
    if n.startswith("kyiv") and ("city" in n or n == "kyiv"):
        return "UA80"
    for key, code in UA_ADMIN1.items():
        if key in ("kyiv", "kyiv city"):
            continue
        if n.startswith(key):
            return code
    return None


def _int(v) -> int:
    try:
        return int(float(v)) if v not in (None, "", "None") else 0
    except (TypeError, ValueError):
        return 0


# Per theme: which columns to sum into extra (killed/injured/etc.)
SUMS = {
    "health": {"killed": "Health Workers Killed", "injured": "Health Workers Injured", "kidnapped": "Health Workers Kidnapped",
               "facilities_destroyed": "Number of Attacks on Health Facilities Reporting Destruction",
               "facilities_damaged": "Number of Attacks on Health Facilities Reporting Damaged"},
    "aid": {"killed": "Aid Workers Killed", "injured": "Aid Workers Injured", "kidnapped": "Aid Workers Kidnapped", "arrested": "Aid Workers Arrested"},
    "education": {"educators_killed": "Educators Killed", "students_killed": "Students Killed", "students_injured": "Students Injured",
                  "schools_attacked": "Attacks on Schools", "universities_attacked": "Attacks on Universities"},
    "explosive": {"aid_workers_killed": "Aid Workers Killed", "health_workers_killed": "Health Workers Killed",
                  "educators_killed": "Educators Killed", "students_killed": "Students Killed",
                  "health_infrastructure": "Health Infrastructure Damaged/Destroyed", "education_infrastructure": "Education Infrastructure Damaged/Destroyed",
                  "water_systems": "Water Systems Damaged/Destroyed", "food_systems": "Food Systems Damaged/Destroyed"},
}


def aggregate(theme: str, header: list[str], rows: Iterable[tuple], iso3_filter: str | None = None) -> list[AreaIndicator]:
    """Fold incident rows into monthly (pcode, theme) counts; admin1 rows plus an admin0 rollup."""
    idx = {str(h).strip(): i for i, h in enumerate(header) if h is not None}
    need = ("Date", "Country ISO", "Admin 1")
    if any(k not in idx for k in need):
        raise ValueError(f"{theme}: missing columns {[k for k in need if k not in idx]} in {list(idx)[:8]}")
    sums = {k: idx.get(col) for k, col in SUMS.get(theme, {}).items()}
    buckets: dict[tuple[str, int, str, str | None, date], dict] = defaultdict(lambda: defaultdict(int))
    for r in rows:
        dt = parse_dt(r[idx["Date"]])
        iso3 = (r[idx["Country ISO"]] or "").strip().upper()
        if dt is None or not iso3 or (iso3_filter and iso3 != iso3_filter):
            continue
        month = dt.date().replace(day=1)
        adm = r[idx["Admin 1"]]
        pcode = admin1_pcode(iso3, adm)
        targets = [(iso3, 0, iso3, None, month)]
        if pcode:
            targets.append((iso3, 1, pcode, str(adm).strip(), month))
        for key in targets:
            b = buckets[key]
            b["n"] += 1
            for name, col in sums.items():
                if col is not None:
                    b[name] += _int(r[col])
    out = []
    for (iso3, level, pcode, name, month), b in buckets.items():
        end = (month.replace(month=month.month % 12 + 1, year=month.year + (month.month == 12)))
        extra = {k: v for k, v in b.items() if k != "n"}
        extra["theme"] = theme
        out.append(AreaIndicator(indicator=f"ii_{theme}", iso3=iso3, admin_level=level, pcode=pcode, area_name=name or None,
                                 period_start=month, period_end=end, value=float(b["n"]), value_text=theme, extra=extra, extra_key=theme))
    return out


def read_xlsx(content: bytes) -> tuple[list, Iterable[tuple]]:
    import openpyxl  # heavy import kept local so tests of the aggregation need no workbook

    wb = openpyxl.load_workbook(io.BytesIO(content), read_only=True, data_only=True)
    ws = wb.worksheets[0]
    rows = ws.iter_rows(values_only=True)
    header = list(next(rows))
    return header, rows


class InsecurityInsightConnector(Connector):
    slug = "insecurity_insight"
    kind = "areas"

    async def fetch(self, since: datetime | None, countries: list[str] | None) -> AsyncIterator[AreaIndicator]:
        cutoff = since.date().replace(day=1) if since else None
        for iso3 in countries or []:
            dataset = DATASETS.get(iso3)
            if not dataset:
                continue
            meta = await self.http.get_json(CKAN, params={"id": dataset})
            resources = (meta.get("result") or {}).get("resources") or []
            for theme, needle in THEMES.items():
                res = next((r for r in resources if needle in str(r.get("name", "")).lower() and "overview" not in str(r.get("name", "")).lower()), None)
                if not res:
                    continue
                resp = await self.http.get(res["url"])
                header, rows = read_xlsx(resp.content)
                for rec in aggregate(theme, header, rows, iso3_filter=iso3):
                    # months are re-counted whole, so a since cutoff only trims very old months
                    if cutoff and rec.period_start < cutoff:
                        continue
                    yield rec
