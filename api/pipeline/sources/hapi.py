"""HDX HAPI (UN OCHA Centre for Humanitarian Data). docs/data-sources.md#hdx-hapi

One connector, several indicators; every row is an AreaIndicator keyed by admin p-code.
IDPs are deliberately not pulled here: HAPI's IDP mirror carries IOM DTM's non-redistributable
terms (see docs/data-sources.md). Conflict counts are ACLED-derived and must be attributed with
the access date wherever they are shown.
"""
from __future__ import annotations

import base64
import os
from datetime import datetime
from typing import AsyncIterator

from pipeline.sources import AreaIndicator, Connector, parse_date

API = "https://hapi.humdata.org/api/v2"
PAGE = 10000
APP_NAME = "open-seldon"


def app_identifier() -> str:
    explicit = os.environ.get("HAPI_APP_IDENTIFIER")
    if explicit:
        return explicit
    email = os.environ.get("HAPI_CONTACT_EMAIL", "olivia@sarapis.org")
    return base64.b64encode(f"{APP_NAME}:{email}".encode()).decode()


def _level(row: dict) -> int:
    lvl = row.get("admin_level")
    if isinstance(lvl, int):
        return lvl
    if row.get("admin2_code"):
        return 2
    if row.get("admin1_code"):
        return 1
    return 0


def _pcode(row: dict, level: int) -> str | None:
    if level == 2:
        return row.get("admin2_code")
    if level == 1:
        return row.get("admin1_code")
    return row.get("location_code")


def _name(row: dict, level: int) -> str | None:
    if level == 2:
        return row.get("admin2_name") or row.get("provider_admin2_name")
    if level == 1:
        return row.get("admin1_name") or row.get("provider_admin1_name")
    return row.get("location_name")


def _base(row: dict, indicator: str):
    level = _level(row)
    pcode = _pcode(row, level)
    iso3 = row.get("location_code")
    start = parse_date(row.get("reference_period_start"))
    if not pcode or not iso3 or not start:
        return None
    return dict(indicator=indicator, iso3=iso3, admin_level=level, pcode=pcode, area_name=_name(row, level),
                period_start=start, period_end=parse_date(row.get("reference_period_end")))


def _num(v):
    try:
        return float(v) if v is not None and v != "" else None
    except (TypeError, ValueError):
        return None


# indicator -> (endpoint path, row parser). Parsers return AreaIndicator | None.
def parse_food_security(row: dict) -> AreaIndicator | None:
    b = _base(row, "ipc_phase")
    if not b:
        return None
    phase = str(row.get("ipc_phase") or "")
    ipc_type = str(row.get("ipc_type") or "")
    return AreaIndicator(**b, value=_num(row.get("population_in_phase")), value_text=phase,
                         extra={"ipc_phase": phase, "ipc_type": ipc_type, "fraction": _num(row.get("population_fraction_in_phase")),
                                "resource_hdx_id": row.get("resource_hdx_id")},
                         extra_key=f"{phase}|{ipc_type}")


def parse_refugees(row: dict) -> AreaIndicator | None:
    # National only; rows are origin x asylum x group x gender x age — keep the totals rows.
    if row.get("gender") not in (None, "", "all") or row.get("age_range") not in (None, "", "all"):
        return None
    b = _base({**row, "location_code": row.get("asylum_location_code") or row.get("location_code"),
               "location_name": row.get("asylum_location_name") or row.get("location_name")}, "refugees")
    if not b:
        return None
    origin = row.get("origin_location_code") or "ALL"
    group = row.get("population_group") or "ALL"
    return AreaIndicator(**b, value=_num(row.get("population")),
                         extra={"origin_iso3": origin, "population_group": group, "resource_hdx_id": row.get("resource_hdx_id")},
                         extra_key=f"{origin}|{group}")


def parse_operational_presence(row: dict) -> AreaIndicator | None:
    b = _base(row, "operational_presence")
    if not b:
        return None
    org = row.get("org_acronym") or row.get("org_name") or "?"
    sector = row.get("sector_code") or row.get("sector_name") or "?"
    return AreaIndicator(**b, value=1, value_text=org,
                         extra={"org_name": row.get("org_name"), "org_type": row.get("org_type_description"), "sector": row.get("sector_name"),
                                "resource_hdx_id": row.get("resource_hdx_id")},
                         extra_key=f"{org}|{sector}")


def parse_national_risk(row: dict) -> AreaIndicator | None:
    b = _base(row, "inform_risk")
    if not b:
        return None
    return AreaIndicator(**b, value=_num(row.get("overall_risk")), value_text=row.get("risk_class"),
                         extra={"global_rank": row.get("global_rank"), "hazard_exposure": _num(row.get("hazard_exposure_risk")),
                                "vulnerability": _num(row.get("vulnerability_risk")), "coping_capacity": _num(row.get("coping_capacity_risk")),
                                "resource_hdx_id": row.get("resource_hdx_id")})


def parse_conflict_events(row: dict) -> AreaIndicator | None:
    b = _base(row, "conflict_events")
    if not b:
        return None
    etype = row.get("event_type") or "all"
    return AreaIndicator(**b, value=_num(row.get("events")), value_text=etype,
                         extra={"fatalities": _num(row.get("fatalities")), "event_type": etype, "provider": "ACLED",
                                "resource_hdx_id": row.get("resource_hdx_id")},
                         extra_key=str(etype))


def parse_food_prices(row: dict) -> AreaIndicator | None:
    b = _base(row, "food_price")
    if not b:
        return None
    market = row.get("market_code") or row.get("market_name") or "?"
    commodity = row.get("commodity_code") or row.get("commodity_name") or "?"
    return AreaIndicator(**b, value=_num(row.get("price")), value_text=row.get("commodity_name"),
                         extra={"market": row.get("market_name"), "lat": _num(row.get("lat")), "lon": _num(row.get("lon")),
                                "currency": row.get("currency_code"), "unit": row.get("unit"), "price_type": row.get("price_type"),
                                "price_flag": row.get("price_flag"), "resource_hdx_id": row.get("resource_hdx_id")},
                         extra_key=f"{market}|{commodity}|{row.get('price_type') or ''}")


ENDPOINTS = {
    "ipc_phase": ("food-security-nutrition-poverty/food-security", parse_food_security),
    "refugees": ("affected-people/refugees-persons-of-concern", parse_refugees),
    "operational_presence": ("coordination-context/operational-presence", parse_operational_presence),
    "inform_risk": ("coordination-context/national-risk", parse_national_risk),
    "conflict_events": ("coordination-context/conflict-events", parse_conflict_events),
    "food_price": ("food-security-nutrition-poverty/food-prices-market-monitor", parse_food_prices),
}


class HapiConnector(Connector):
    slug = "hapi"
    kind = "areas"

    async def fetch(self, since: datetime | None, countries: list[str] | None) -> AsyncIterator[AreaIndicator]:
        indicators = self.config.get("indicators") or list(ENDPOINTS)
        for iso3 in countries or []:
            for name in indicators:
                path, parse = ENDPOINTS[name]
                offset = 0
                while True:
                    params = {"location_code": iso3, "output_format": "json", "limit": PAGE, "offset": offset,
                              "app_identifier": app_identifier()}
                    if name == "refugees":
                        params = {**params, "asylum_location_code": iso3}
                        params.pop("location_code")
                    data = await self.http.get_json(f"{API}/{path}", params=params)
                    rows = data.get("data") if isinstance(data, dict) else data
                    rows = rows or []
                    for row in rows:
                        rec = parse(row)
                        if rec:
                            yield rec
                    if len(rows) < PAGE:
                        break
                    offset += PAGE
