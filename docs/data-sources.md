# Open data sources

Catalogue of the external datasets Open Seldon integrates or has evaluated, with the access
method, licence and attribution each one requires. Verified against the live endpoints and
licence pages on 2026-10-20 unless marked *unverified*. Keep this file current: every connector
in `api/pipeline/sources/` must have an entry here, and the `attribution_text` it stores must match
the attribution column.

Open Seldon is free and open source and may be self-hosted by NGOs, so each source is judged on
whether its data may be **redistributed through a public dashboard**. Sources that only allow
non-commercial or non-redistributable use are either taken through a permissive mirror (usually
HDX) or kept out.

## Status key

| Status | Meaning |
|---|---|
| **live** | connector shipped and scheduled |
| **planned** | in the integration plan with a slice number (see `open-data-integration.md`) |
| **mirror-only** | usable only through a permissively licensed copy on HDX |
| **excluded** | licence or access rules out redistribution; may be revisited |

## United Nations and UN-coordinated data

### HDX HAPI — OCHA Centre for Humanitarian Data (planned, slice P4.0 ingestion / P4.2 map)

- **What:** standardised indicators from 14 endpoints: food security (IPC/CH), IDPs (IOM DTM),
  refugees and returnees (UNHCR), humanitarian needs (OCHA HPC), operational presence (OCHA 3W),
  funding (OCHA FTS), national risk (INFORM), food prices (WFP), poverty, population (COD-PS),
  rainfall (CHIRPS via WFP), conflict events (ACLED, monthly counts per admin area).
- **Access:** `https://hapi.humdata.org/api/v2/<group>/<endpoint>`; identifier
  `app_identifier = base64("app_name:email")` as query param or `X-HDX-HAPI-APP-IDENTIFIER`
  header (generate with `/api/v2/encode_app_identifier`). No account. `limit` ≤ 10,000, `offset`
  paging, JSON or CSV. Courtesy limit 1 request/second. Filter by ISO3 codes: string filters are
  case-insensitive wildcards (`location_name=Mali` also matches Somalia).
- **Geography:** ISO3 + admin1/admin2 p-codes only; no geometry except WFP market lat/lon. Join
  to COD-AB boundaries (below). 3W keeps only the latest resource.
- **Licence:** per upstream dataset — mostly CC BY and CC BY-IGO. The ACLED-derived
  `conflict-events` endpoint carries ACLED's terms (attribution with access date; aggregate use
  only). HAPI itself is beta; read `https://data.humdata.org/hapi/terms` in a browser (JS-gated).
- **Attribution:** "Source: OCHA HDX HAPI — <upstream provider>, <dataset>, accessed <date>".
- **Cadence:** refreshed daily from HDX; upstream varies (weekly to yearly).
- **Gotchas:** mandatory identifier; 1 req/s; p-codes not always present at admin2.

### HDX CKAN — dataset metadata and files (planned, used by several connectors)

- **Access:** `https://data.humdata.org/api/3/action/package_show?id=<name>` and
  `package_search?q=…&fq=…&rows=1000`, no key for reads; download
  `https://data.humdata.org/dataset/<id>/resource/<rid>/download/<file>`.
  Use `last_modified` and `data_update_frequency` for nightly change detection.
- **Gotchas:** dataset HTML pages block bots and are JS-rendered; use the JSON endpoints.
  Resources are arbitrary files (XLSX, SHP, GDB, zipped GeoJSON).

### OCHA COD-AB — administrative boundaries (planned, slice P4.2)

- **What:** Common Operational Dataset administrative boundaries per country, admin0–admin2+,
  with p-codes that match HAPI and most HDX datasets.
- **Access:** HDX datasets `cod-ab-<iso3>` (e.g. `cod-ab-ukr`), GeoJSON/SHP/GDB, ~80 MB per
  country unsimplified. Simplify server-side and cache.
- **Licence:** CC BY-IGO. **Attribution:** "OCHA COD-AB, <country>, via HDX".
- **Cadence:** yearly.

### UNHCR Refugee Data Finder API (planned, slice P4.2)

- **What:** annual stocks by country of origin × asylum (refugees, asylum-seekers, IDPs,
  returnees, stateless), asylum applications/decisions, demographics.
- **Access:** `https://api.unhcr.org/population/v1/{population,asylum-applications,
  asylum-decisions,demographics}/?year=…&coo=…&coa=…&cf_type=ISO&limit=…&page=…`; no key.
  Also available through HAPI `affected-people/refugees-persons-of-concern`.
- **Geography:** country × year. **Licence:** CC BY 4.0 (quote the live terms page before shipping;
  it blocked automated fetches). **Attribution:** "UNHCR Refugee Population Statistics Database".
- **Cadence:** Global Trends mid-June, Mid-Year Trends ~October — poll weekly.
- **Also:** Operational Data Portal has undocumented JSON widget endpoints (unstable ids) and
  ArcGIS services with camp/settlement points whose licence is not stated — ask before use.

### IOM Displacement Tracking Matrix (mirror-only)

- **What:** IDP stock figures by admin0–2 per assessment round; flow monitoring.
- **Direct API:** `https://dtmapi.iom.int/v3/…` with a portal key — **DTM's terms are
  non-commercial and forbid redistribution or derivatives without written permission**, which an
  open-source dashboard cannot honour. HAPI's IDP mirror on HDX is licensed "hdx-other" (DTM terms).
- **Use instead:** HDX country datasets that IOM publishes under **CC BY** (e.g. Sudan,
  Cameroon, CAR) — check `license_id` per dataset via CKAN before enabling. Ask
  DTMSupport@iom.int for written permission if a non-CC-BY country is needed.
- **Attribution:** "International Organization for Migration (IOM), <month year>, Displacement
  Tracking Matrix (DTM)".

### IOM Missing Migrants Project (planned, slice P4.1)

- **What:** incident-level records of migrant deaths and disappearances: coordinates, route,
  cause, counts, source URL.
- **Access:** CSV/XLSX downloads at `https://missingmigrants.iom.int/downloads`; HDX mirror
  `iom-missing-migrants-project-data` (may lag the IOM site).
- **Licence:** CC BY 4.0 (HDX copy CC BY-IGO). **Attribution:** "IOM's Missing Migrants Project".
- **Schema fit:** point events; category `safety`/`border`.

### WFP food prices (planned, slice P4.2)

- **What:** monthly commodity prices from ~3,000 markets in ~98 countries, with market lat/lon.
- **Access:** HDX "Global - Food Prices" (`global-wfp-food-prices`, yearly CSVs 40–70 MB, updated
  weekly) or HAPI `food-security-nutrition-poverty/food-prices-market-monitor` +
  `metadata/wfp-market`.
- **Licence:** CC BY-IGO. **Attribution:** "WFP VAM Food Prices via HDX".
- **Note:** WFP HungerMap LIVE was rebuilt in April 2026 and its API is behind a login with no
  public terms — **excluded** until WFP publishes access rules.

### IPC / Cadre Harmonisé food security (planned, slice P4.2)

- **What:** acute food insecurity phase (1–5) and population per phase per analysis area.
- **Access:** HDX "Global: Acute Food Insecurity Country Data"
  (`global-acute-food-insecurity-country-data`) — **CC0**, national/level1/area CSVs — or HAPI
  `food-security`. The direct IPC API (`api.ipcinfo.org`) needs an approved key and a restrictive
  ToU; not used.
- **Geography:** admin1/2 or livelihood zones; no geometry — join by p-code.
- **Attribution:** "IPC via HDX".

### OCHA 3W operational presence (planned, slice P4.2)

- **What:** which organisation works in which sector in which admin area.
- **Access:** HAPI `coordination-context/operational-presence` (latest resource only) or the HDX
  mirror `hdx-hapi-operational-presence` (21 countries, CC BY-IGO).
- **Gotchas:** irregular cadence; org names inconsistent across releases; rows without sector dropped.

### INFORM risk (planned, slice P4.2)

- **What:** country composite risk scores (hazard, vulnerability, coping capacity); coordinated
  by UNDP since 2026 with EC JRC as scientific lead.
- **Access:** HDX `inform-risk-index` CSV (CC BY) or HAPI `coordination-context/national-risk`.
- **Attribution:** "INFORM Risk Index — UNDP / European Commission Joint Research Centre".

### ReliefWeb (planned, slice P4.3)

- **What:** OCHA's humanitarian reports and disaster records, full text, country tags, themes.
- **Access:** `https://api.reliefweb.int/v2/reports` (v1 is being switched off). **Requires a
  pre-approved `appname`** since November 2025 (see `reliefweb-appname-request.md`). 1,000 results
  per call, 1,000 calls per day.
- **Licence:** API docs say CC BY 4.0, but the site Terms say personal, non-commercial use with no
  redistribution or derivatives, and partner content stays copyrighted by its publisher. Design
  around the stricter reading: **store title, source, date, country, theme and a short snippet
  plus the ReliefWeb URL; never republish full partner text.**
- **Attribution:** "<publisher> via ReliefWeb (OCHA)".

### OCHA FTS funding flows (evaluated, not planned)

- `https://api.hpc.tools/v1/public/fts/flow?year=…`, no auth, country level, licence unstated.
  Low fit for a map; revisit if a funding view is wanted.

## Other intergovernmental and open sources

### GDACS — Global Disaster Alert and Coordination System (planned, slice P4.0)

A joint UN OCHA / European Commission JRC service.

- **What:** earthquake, cyclone, flood, volcano, drought and wildfire alerts with green/orange/red
  levels, severity, affected countries, centroid points and impact polygons.
- **Access:** `https://www.gdacs.org/gdacsapi/api/events/geteventlist/latest?datemodified=<ISO>`
  for nightly deltas; `…/geteventlist/search?eventlist=EQ;TC;FL;VO;DR;WF&alertlevel=…&fromDate=…`;
  `…/polygons/getgeometry?eventtype=&eventid=&episodeid=`. No auth; 100 records per call;
  RSS feeds refresh every 6 minutes.
- **Licence:** terms are disclaimers only; GDACS asks for acknowledgement as "Global Disaster
  Alert and Coordination System, GDACS". Per-event RSS resources are CC BY 4.0.
- **Gotchas:** `country` may be free text with an empty `iso3`; alert-level casing varies.

### IDMC Internal Displacement Updates (planned, slice P4.1)

- **What:** near-real-time displacement events with coordinates, figures, type, sources.
- **Access:** the IDMC API needs a key by email; use the **HDX per-country daily CSVs**
  (e.g. `ukr-idmc-idu-events`, columns id, iso3, latitude, longitude, displacement_type, figure,
  displacement_date, event_name, sources, source_url, locations_name).
- **Licence:** CC BY-IGO (HDX). **Attribution:** "IDMC Internal Displacement Updates via HDX".

### Insecurity Insight (planned, slice P4.1)

- **What:** attacks on health care, aid workers, education, explosive-weapon incidents; lat/lon,
  admin1, perpetrator, impacts. Coordinates censored in some contexts (e.g. Gaza).
- **Access:** HDX organisation `insecurity-insight`, XLSX, weekly batches.
- **Licence:** CC BY-SA (a few CC BY / CC BY-IGO). Share-alike applies only if a derived
  dataset is redistributed. **Attribution:** "Insecurity Insight via HDX".

### Copernicus Emergency Management Service (planned, slice P4.4)

- **Access:** `https://mapping.emergency.copernicus.eu/activations/api/activations/` (no auth;
  centroid, country, category, product counts); products as zip/GeoJSON.
- **Licence:** free, full and open under Regulation (EU) 2021/696; cite "Copernicus Emergency
  Management Service (© European Union, 2012–<year>)".

### UCDP — Uppsala Conflict Data Program (evaluated, slice P4.4 if licence confirmed)

- Monthly candidate events with coordinates; token by email, 5,000 req/day; licence not stated
  on the API docs — obtain it in writing before use.

### Eurostat asylum statistics (evaluated)

- JSON-stat at `https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/migr_asyappctzm`;
  free reuse incl. commercial with "Source: Eurostat". Country × month only.

## Excluded (for now)

| Source | Why |
|---|---|
| ACLED raw events | EULA: non-commercial only, data may not be made available through a dashboard, no re-serving. Use HAPI's aggregated counts with attribution and access date instead. |
| IOM DTM direct API | Non-commercial, no redistribution or derivatives. Use CC BY HDX copies. |
| WHO Disease Outbreak News | CC BY-NC-SA 3.0 IGO. Links and short summaries only; skipped in v1. |
| WFP HungerMap LIVE | Behind a login since April 2026; no public terms. |
| GDELT | Open, but noisy; better as an enrichment signal than a layer. Phase 5. |
| EIOS, ProMED, Liveuamap | Not public / paid. |

## Attribution and licence rules the UI must enforce

- Every layer shows its `attribution_text` in the layer list and in the map's attribution strip
  while it is visible; layers derived from ACLED counts also show the access date.
- `sources.licence_id` drives a per-layer badge; self-hosters disable any layer by setting
  `sources.enabled = false`.
- Share-alike (CC BY-SA, ODbL) only binds redistributed *derived datasets*; displaying the data
  is fine. Do not merge share-alike records into exports of other sources.
