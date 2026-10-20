"""Unit tests for the open-data connectors' parsers (no network)."""
from datetime import date, datetime, timezone

from pipeline.sources import parse_date, parse_dt
from pipeline.sources.gdacs import parse_feature
from pipeline.sources.hapi import (
    app_identifier, parse_conflict_events, parse_food_prices, parse_food_security, parse_national_risk,
    parse_operational_presence, parse_refugees,
)

GDACS_FEATURE = {
    "type": "Feature",
    "geometry": {"type": "Point", "coordinates": [25.6, 48.9]},
    "properties": {
        "eventtype": "FL", "eventid": 1012345, "episodeid": 7, "eventname": "", "name": "Flood in Ukraine",
        "description": "Orange flood alert in Ukraine", "alertlevel": "Orange", "alertscore": 2,
        "country": "Ukraine", "iso3": "UKR", "affectedcountries": [{"iso3": "UKR", "countryname": "Ukraine"}],
        "fromdate": "2026-10-18T00:00:00", "todate": "2026-10-21T00:00:00", "datemodified": "2026-10-20T06:12:00",
        "source": "GLOFAS", "severitydata": {"severity": 210000, "severitytext": "Magnitude 210000 people affected", "severityunit": "people"},
        "iscurrent": "true", "url": {"report": "https://www.gdacs.org/report.aspx?eventid=1012345&eventtype=FL"},
    },
}


def test_gdacs_feature_parses_to_point_event():
    ev = parse_feature(GDACS_FEATURE)
    assert ev is not None
    assert ev.source_record_id == "FL-1012345"
    assert ev.title.startswith("Flood")
    assert (ev.lon, ev.lat) == (25.6, 48.9)
    assert ev.iso3 == "UKR"
    assert ev.alert_level == "orange"
    assert ev.occurred_at == datetime(2026, 10, 18, tzinfo=timezone.utc)
    assert ev.reported_at == datetime(2026, 10, 20, 6, 12, tzinfo=timezone.utc)
    assert ev.metrics["affected_iso3"] == ["UKR"]
    assert ev.url.startswith("https://www.gdacs.org/report.aspx")
    assert len(ev.content_hash()) == 32


def test_gdacs_feature_without_id_is_skipped():
    bad = {"type": "Feature", "geometry": None, "properties": {"eventtype": "EQ"}}
    assert parse_feature(bad) is None


def test_gdacs_empty_iso3_falls_back_to_affected_countries():
    f = {**GDACS_FEATURE, "properties": {**GDACS_FEATURE["properties"], "iso3": "", "country": "Vanuatu Islands",
                                          "affectedcountries": [{"iso3": "VUT"}]}}
    assert parse_feature(f).iso3 == "VUT"


HAPI_COMMON = {"location_code": "UKR", "location_name": "Ukraine", "admin1_code": "UA65", "admin1_name": "Khersonska",
               "admin2_code": None, "admin_level": 1, "reference_period_start": "2026-06-01T00:00:00",
               "reference_period_end": "2026-09-30T00:00:00", "resource_hdx_id": "abc"}


def test_hapi_food_security_row():
    rec = parse_food_security({**HAPI_COMMON, "ipc_phase": "3+", "ipc_type": "current", "population_in_phase": "310000",
                               "population_fraction_in_phase": "0.31"})
    assert rec.indicator == "ipc_phase" and rec.pcode == "UA65" and rec.admin_level == 1
    assert rec.value == 310000.0 and rec.extra_key == "3+|current"
    assert rec.period_start == date(2026, 6, 1) and rec.period_end == date(2026, 9, 30)


def test_hapi_refugees_keeps_only_totals_and_uses_asylum_country():
    base = {"asylum_location_code": "POL", "asylum_location_name": "Poland", "origin_location_code": "UKR",
            "population_group": "REF", "reference_period_start": "2026-01-01", "population": "950000", "admin_level": 0}
    assert parse_refugees({**base, "gender": "all", "age_range": "all"}).pcode == "POL"
    assert parse_refugees({**base, "gender": "f", "age_range": "all"}) is None


def test_hapi_operational_presence_row():
    rec = parse_operational_presence({**HAPI_COMMON, "org_acronym": "NRC", "org_name": "Norwegian Refugee Council",
                                      "sector_code": "SHL", "sector_name": "Shelter"})
    assert rec.indicator == "operational_presence" and rec.value == 1 and rec.extra_key == "NRC|SHL"


def test_hapi_national_risk_row():
    rec = parse_national_risk({"location_code": "UKR", "location_name": "Ukraine", "admin_level": 0,
                               "reference_period_start": "2026-01-01", "overall_risk": "6.9", "risk_class": "High", "global_rank": 21})
    assert rec.pcode == "UKR" and rec.value == 6.9 and rec.value_text == "High" and rec.extra["global_rank"] == 21


def test_hapi_conflict_events_row_marks_acled_provider():
    rec = parse_conflict_events({**HAPI_COMMON, "event_type": "political_violence", "events": 120, "fatalities": 14})
    assert rec.indicator == "conflict_events" and rec.value == 120 and rec.extra["provider"] == "ACLED"


def test_hapi_food_price_row_keeps_market_coordinates():
    rec = parse_food_prices({**HAPI_COMMON, "market_code": "M1", "market_name": "Kherson", "commodity_code": "C1",
                             "commodity_name": "Wheat flour", "price": "42.5", "currency_code": "UAH", "unit": "KG",
                             "price_type": "Retail", "lat": "46.6", "lon": "32.6"})
    assert rec.indicator == "food_price" and rec.value == 42.5 and rec.extra["lat"] == 46.6 and rec.extra_key == "M1|C1|Retail"


def test_hapi_row_without_pcode_or_period_is_skipped():
    assert parse_food_security({"location_code": "UKR", "admin_level": 1}) is None


def test_app_identifier_is_base64_of_app_and_email(monkeypatch):
    monkeypatch.delenv("HAPI_APP_IDENTIFIER", raising=False)
    monkeypatch.setenv("HAPI_CONTACT_EMAIL", "team@example.org")
    import base64
    assert base64.b64decode(app_identifier()).decode() == "open-seldon:team@example.org"


def test_idmc_row_parses_with_figure_and_coordinates():
    from pipeline.sources.idmc_hdx import parse_row
    ev = parse_row({"id": "123456", "country": "Ukraine", "iso3": "UKR", "latitude": "49.99", "longitude": "36.23",
                    "displacement_type": "Conflict", "figure": "1500", "displacement_date": "2026-10-18",
                    "displacement_start_date": "2026-10-17", "displacement_end_date": "2026-10-18",
                    "event_name": "Kharkiv: Shelling", "category": "Conflict", "subcategory": "Armed conflict",
                    "sources": "OCHA", "source_url": "https://example.org/report", "locations_name": "Kharkiv",
                    "locations_accuracy": "Point", "created_at": "2026-10-19T08:00:00"})
    assert ev is not None
    assert ev.source_record_id == "123456" and ev.iso3 == "UKR"
    assert ev.title == "Kharkiv: Shelling: 1,500 displaced"
    assert (ev.lat, ev.lon) == (49.99, 36.23) and ev.metrics["figure"] == 1500.0
    assert ev.category == "safety" and ev.event_type == "Conflict"
    assert ev.reference_period_start == date(2026, 10, 17)


def test_idmc_row_without_id_or_date_is_skipped():
    from pipeline.sources.idmc_hdx import parse_row
    assert parse_row({"id": "", "displacement_date": "2026-10-18"}) is None
    assert parse_row({"id": "1", "displacement_date": ""}) is None


def test_parse_dt_handles_naive_and_zulu():
    assert parse_dt("2026-10-20T06:12:00Z") == datetime(2026, 10, 20, 6, 12, tzinfo=timezone.utc)
    assert parse_dt("2026-10-20T06:12:00").tzinfo is not None
    assert parse_date("2026-10-20") == date(2026, 10, 20)
    assert parse_dt("") is None
