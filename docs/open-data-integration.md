# Open data integration — design

Phase 4 of the roadmap: external humanitarian datasets as toggleable map layers beside the
Telegram feed, pulled automatically every night, licence-safe for self-hosters. Sources and
their terms are catalogued in `data-sources.md`.

## Principles

1. External data never mixes with `messages` / `processed_messages`. The Telegram feed stays the
   product's core signal; layers sit beside it.
2. Every ingested record carries provenance (`source_slug`, `source_record_id`, `source_url`,
   `fetched_at`, `reference_period_*`) and every source carries `licence_id` and
   `attribution_text`, so attribution renders automatically and any layer can be switched off
   by configuration.
3. Dedup only within a source (deterministic `source_record_id` upsert). Across sources we link,
   never merge: a GDACS flood, an IDMC displacement figure and a Telegram post about the same
   event are different evidence.
4. Aggregates render as choropleths on OCHA COD-AB boundaries, never as fake points at centroids.
   Point feeds use the existing dot renderer.
5. Nothing in the first slices needs an API key except ReliefWeb's pre-approved appname. No LLM
   calls except ReliefWeb geocoding.

## Decisions taken (2026-10-20)

| Question | Decision |
|---|---|
| Initial country set | UKR, POL, MDA, ROU, SVK, HUN (the corridor the Telegram channels cover); configurable per source via `sources.countries` |
| GDACS scope | global, filtered by the viewport in the UI; default **on** |
| ACLED-derived counts via HAPI | included, with "ACLED" attribution and access date; raw ACLED never ingested |
| WHO Disease Outbreak News | skipped in v1 (CC BY-NC-SA) |
| ReliefWeb appname | request drafted in `reliefweb-appname-request.md`; slice P4.3 waits for approval |
| Other layers default | off until the user toggles them |

## Data model

Idempotent SQL in `scripts/init-open-data.sql`, mounted as `50-open-data.sql` for fresh installs
and applied by hand to the live database (the init folder only runs on an empty volume).

```
sources           one row per connector: slug PK, name, provider, kind (points|areas|documents),
                  licence_id, attribution_text, homepage, enabled, default_on, cadence (daily|weekly),
                  countries TEXT[] (NULL = global), config JSONB, last_run_at, last_success_at,
                  last_error, record_count
external_events   point-shaped records: id, source_slug FK, source_record_id, UNIQUE(source_slug,
                  source_record_id); event_type (source-native), category (our taxonomy key or NULL),
                  title, summary, url, occurred_at, reported_at, lat, lon, precision, iso3,
                  admin1_code, admin2_code, severity (text), alert_level (text), metrics JSONB,
                  raw JSONB, content_hash, fetched_at, reference_period_start/end
area_indicators   aggregate records: id, source_slug FK, indicator (ipc_phase, idps, refugees,
                  operational_presence, inform_risk, food_price, conflict_events, …), iso3,
                  admin_level, pcode, area_name, period_start, period_end, value NUMERIC,
                  value_text, extra JSONB, fetched_at; UNIQUE(source_slug, indicator, pcode,
                  period_start, COALESCE(extra->>'key',''))
admin_areas       COD-AB: iso3, admin_level, pcode PK, name, parent_pcode, centroid_lat/lon,
                  geometry JSONB (simplified GeoJSON), fetched_at
source_runs       audit log: id, source_slug, started_at, finished_at, ok, records_seen,
                  records_upserted, error
```

Indexes: `external_events (source_slug, occurred_at DESC)`, `external_events (iso3)`,
`external_events (lat, lon)`, `area_indicators (source_slug, indicator, period_start DESC)`,
`admin_areas (iso3, admin_level)`.

## Connector contract (`api/pipeline/sources/`)

```python
class Connector:
    slug: str                      # matches sources.slug
    kind: Literal["points", "areas", "documents"]
    async def fetch(self, since: datetime | None, countries: list[str] | None) -> AsyncIterator[Record]
```

`Record` is a dataclass per kind (`PointEvent`, `AreaIndicator`, `Document`) with the columns
above. The runner `pipeline/run_sources.py`:

- loads enabled sources, respects `cadence` (weekly sources run only if `last_success_at` is
  older than 6 days), runs connectors sequentially with concurrency 1 per source;
- wraps HTTP in a shared client with exponential backoff on 429/5xx (base 2 s, max 5 tries),
  a project `User-Agent`, and a per-host minimum interval (1 s for HAPI);
- upserts in batches of 500 inside one transaction per source, updates `sources.record_count`,
  `last_run_at`, `last_success_at` / `last_error`, writes a `source_runs` row;
- never aborts the run for one source's failure; prints a JSON summary line like `run_daily`;
- is invoked by the daily GitHub Actions job right after `pipeline.run_daily`.

Change detection: HDX-backed connectors call CKAN `package_show` first and skip the download when
`last_modified` is unchanged (stored in `sources.config.last_modified`). GDACS uses
`geteventlist/latest?datemodified=<last_success_at>`.

### Connectors by slice

| Slice | Connector | Kind | Source of truth |
|---|---|---|---|
| P4.0 | `gdacs` | points | GDACS API `latest` + `search` backfill (90 days) |
| P4.0 | `hapi` (ipc, idps*, refugees, operational_presence, inform_risk, food_prices, conflict_events) | areas | HAPI v2 for the country set; *IDPs only where the upstream HDX dataset is CC BY |
| P4.1 | `idmc_hdx` | points | HDX `<iso3>-idmc-idu-events` CSVs |
| P4.1 | `iom_mmp` | points | Missing Migrants CSV (Europe + Mediterranean routes) |
| P4.1 | `insecurity_insight` | points | HDX XLSX (attacks on health care, aid workers) |
| P4.2 | `cod_ab` | boundaries | HDX `cod-ab-<iso3>` → `admin_areas` |
| P4.3 | `reliefweb` | documents | API v2 reports, snippet + URL only |
| P4.4 | `copernicus_ems`, `ucdp` | points | opportunistic |

## API

- `GET /layers` — every enabled source: slug, name, provider, kind, licence_id, attribution_text,
  default_on, record_count, last_success_at, countries. Cached 60 s.
- `GET /layers/{slug}/events?since=&until=&bbox=minLon,minLat,maxLon,maxLat&limit=5000` —
  point records (GeoJSON-ready fields), newest first. Cached 60 s.
- `GET /layers/{slug}/areas?indicator=&iso3=&period=latest` — aggregate values joined to
  `admin_areas` (pcode, name, geometry) for one indicator; `period=latest` returns the most recent
  period per pcode.
- `GET /layers/summary?iso3=UKR,POL` — latest headline indicators per country (IPC population in
  phase 3+, IDPs, refugees hosted, INFORM risk class, conflict events last month) for the "UN
  data" cards before boundaries exist.
- All public like `/dashboard`; the Next.js rewrite already proxies `/api/layers/*`.

## Frontend

- **Sidebar → Layers section** under the channel list: one row per source — toggle, name, "as of
  <date>", licence badge; hovering/expanding shows `attribution_text` and the source link.
  GDACS defaults on, others off; visibility persisted in `localStorage`.
- **Map:** one deck.gl `ScatterplotLayer` per visible point source with a fixed colour per source
  (GDACS alert colours green/orange/red override), picking enabled; clicking opens a detail card
  (title, date, source line, "Open at <provider>" link). HAPI indicators render as a
  `GeoJsonLayer` choropleth with a legend once `admin_areas` exist (P4.2); until then the
  "UN data" cards show the latest indicator values per country.
- **Attribution strip:** bottom-right, always visible, lists the basemap plus every visible
  layer's attribution; ACLED-derived layers append "accessed <date>".
- **Freshness:** each layer row shows `last_success_at`; a layer older than 2× its cadence is
  marked stale.
- Mobile: the Layers section lives in the same sheet as channels.

Wireframes: https://claude.ai/artifact/VeFCJK3pBxLN6SAVSvQA7i (desktop layers panel, UN data cards,
choropleth, change strip, phone sheet).

## Operations

- Scheduled by `.github/workflows/daily-pipeline.yml` after the Telegram stages; a failing
  source marks `last_error` and the run still succeeds unless every source failed.
- `/health` gains `layers: {slug: last_success_at}`; the daily audit can assert freshness.
- Cost: no model calls except ReliefWeb geocoding (Gemini Flash); storage tens of MB.
- Backfill: `python -m pipeline.run_sources --source gdacs --since 2026-01-01`.

## Testing

- Unit tests per connector with fixture payloads under `api/tests/fixtures/<slug>/`
  (parsing, normalisation, idempotent upsert).
- A weekly `workflow_dispatch`-able job runs each connector against the live API with
  `--dry-run` and reports schema drift.
- UI verified in the browser (desktop and phone widths, both themes) before each slice is merged.

## Delivery slices

1. **P4.0 Foundation + GDACS + HAPI ingestion** — schema, connector framework, `run_sources`,
   `/layers*`, sidebar toggles, GDACS points, attribution strip, UN data cards.
2. **P4.1 Displacement and migration points** — IDMC via HDX, IOM Missing Migrants, Insecurity Insight.
3. **P4.2 Boundaries and choropleths** — COD-AB loader, HAPI indicators on the map, legend.
4. **P4.3 ReliefWeb** — after appname approval.
5. **P4.4 Opportunistic** — Copernicus EMS, UCDP (licence permitting).
