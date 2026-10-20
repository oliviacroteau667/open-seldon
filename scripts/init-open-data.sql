-- External open-data layers (GDACS, HDX HAPI, IDMC, …). Separate from the Telegram tables.
-- Idempotent: safe to re-run on a live DB. Design: docs/open-data-integration.md

CREATE TABLE IF NOT EXISTS sources (
    slug              TEXT PRIMARY KEY,
    name              TEXT NOT NULL,
    provider          TEXT NOT NULL,
    kind              TEXT NOT NULL CHECK (kind IN ('points', 'areas', 'documents', 'boundaries')),
    licence_id        TEXT NOT NULL,
    attribution_text  TEXT NOT NULL,
    homepage          TEXT,
    enabled           BOOLEAN NOT NULL DEFAULT TRUE,
    default_on        BOOLEAN NOT NULL DEFAULT FALSE,
    cadence           TEXT NOT NULL DEFAULT 'daily' CHECK (cadence IN ('daily', 'weekly')),
    countries         TEXT[],                       -- ISO3 filter; NULL = global
    config            JSONB NOT NULL DEFAULT '{}'::jsonb,
    last_run_at       TIMESTAMPTZ,
    last_success_at   TIMESTAMPTZ,
    last_error        TEXT,
    record_count      INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS external_events (
    id                      BIGSERIAL PRIMARY KEY,
    source_slug             TEXT NOT NULL REFERENCES sources(slug) ON DELETE CASCADE,
    source_record_id        TEXT NOT NULL,
    event_type              TEXT,                 -- source-native type, e.g. GDACS "FL"
    category                TEXT,                 -- our taxonomy key (housing, safety, …) or NULL
    title                   TEXT NOT NULL,
    summary                 TEXT,
    url                     TEXT,
    occurred_at             TIMESTAMPTZ NOT NULL,
    reported_at             TIMESTAMPTZ,
    lat                     DOUBLE PRECISION,
    lon                     DOUBLE PRECISION,
    precision               TEXT,                 -- point | admin1 | admin2 | country
    iso3                    TEXT,
    admin1_code             TEXT,
    admin2_code             TEXT,
    severity                TEXT,
    alert_level             TEXT,                 -- green | orange | red (GDACS) or NULL
    metrics                 JSONB NOT NULL DEFAULT '{}'::jsonb,
    raw                     JSONB,
    content_hash            TEXT,
    fetched_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reference_period_start  DATE,
    reference_period_end    DATE,
    UNIQUE (source_slug, source_record_id)
);

CREATE INDEX IF NOT EXISTS idx_external_events_source_time ON external_events (source_slug, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_external_events_iso3 ON external_events (iso3);
CREATE INDEX IF NOT EXISTS idx_external_events_latlon ON external_events (lat, lon);

CREATE TABLE IF NOT EXISTS area_indicators (
    id              BIGSERIAL PRIMARY KEY,
    source_slug     TEXT NOT NULL REFERENCES sources(slug) ON DELETE CASCADE,
    indicator       TEXT NOT NULL,                -- ipc_phase, idps, refugees, operational_presence, inform_risk, food_price, conflict_events
    iso3            TEXT NOT NULL,
    admin_level     SMALLINT NOT NULL,
    pcode           TEXT NOT NULL,                -- ISO3 at admin0
    area_name       TEXT,
    period_start    DATE NOT NULL,
    period_end      DATE,
    value           NUMERIC,
    value_text      TEXT,
    extra           JSONB NOT NULL DEFAULT '{}'::jsonb,
    extra_key       TEXT NOT NULL DEFAULT '',     -- disambiguates rows sharing indicator/pcode/period (e.g. commodity, sector)
    fetched_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (source_slug, indicator, pcode, period_start, extra_key)
);

CREATE INDEX IF NOT EXISTS idx_area_indicators_lookup ON area_indicators (source_slug, indicator, period_start DESC);
CREATE INDEX IF NOT EXISTS idx_area_indicators_iso3 ON area_indicators (iso3, indicator);

CREATE TABLE IF NOT EXISTS admin_areas (
    pcode           TEXT PRIMARY KEY,
    iso3            TEXT NOT NULL,
    admin_level     SMALLINT NOT NULL,
    name            TEXT NOT NULL,
    parent_pcode    TEXT,
    centroid_lat    DOUBLE PRECISION,
    centroid_lon    DOUBLE PRECISION,
    geometry        JSONB,                        -- simplified GeoJSON geometry
    fetched_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_areas_iso3_level ON admin_areas (iso3, admin_level);

CREATE TABLE IF NOT EXISTS source_runs (
    id                BIGSERIAL PRIMARY KEY,
    source_slug       TEXT NOT NULL REFERENCES sources(slug) ON DELETE CASCADE,
    started_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at       TIMESTAMPTZ,
    ok                BOOLEAN,
    records_seen      INTEGER NOT NULL DEFAULT 0,
    records_upserted  INTEGER NOT NULL DEFAULT 0,
    error             TEXT
);

-- Seed the catalogue. Connectors not yet written are disabled until their slice ships.
INSERT INTO sources (slug, name, provider, kind, licence_id, attribution_text, homepage, enabled, default_on, cadence, countries) VALUES
  ('gdacs', 'GDACS disaster alerts', 'UN OCHA / European Commission JRC', 'points',
   'GDACS-ToU', 'Global Disaster Alert and Coordination System, GDACS', 'https://www.gdacs.org', TRUE, TRUE, 'daily', NULL),
  ('hapi', 'HDX HAPI humanitarian indicators', 'UN OCHA Centre for Humanitarian Data', 'areas',
   'mixed (CC BY / CC BY-IGO; ACLED terms for conflict counts)', 'OCHA HDX HAPI — see per-indicator provider', 'https://hapi.humdata.org', TRUE, FALSE, 'daily',
   ARRAY['UKR','POL','MDA','ROU','SVK','HUN']),
  ('idmc_hdx', 'IDMC displacement events', 'Internal Displacement Monitoring Centre', 'points',
   'CC BY-IGO', 'IDMC Internal Displacement Updates via HDX', 'https://www.internal-displacement.org', FALSE, FALSE, 'daily',
   ARRAY['UKR','POL','MDA','ROU','SVK','HUN']),
  ('iom_mmp', 'IOM Missing Migrants', 'International Organization for Migration', 'points',
   'CC BY 4.0', 'IOM''s Missing Migrants Project', 'https://missingmigrants.iom.int', FALSE, FALSE, 'weekly', NULL),
  ('insecurity_insight', 'Attacks on health care and aid workers', 'Insecurity Insight', 'points',
   'CC BY-SA 4.0', 'Insecurity Insight via HDX', 'https://insecurityinsight.org', FALSE, FALSE, 'weekly',
   ARRAY['UKR','POL','MDA','ROU','SVK','HUN']),
  ('cod_ab', 'OCHA administrative boundaries', 'UN OCHA', 'boundaries',
   'CC BY-IGO', 'OCHA COD-AB via HDX', 'https://data.humdata.org', FALSE, FALSE, 'weekly',
   ARRAY['UKR','POL','MDA','ROU','SVK','HUN']),
  ('reliefweb', 'ReliefWeb reports', 'UN OCHA ReliefWeb', 'documents',
   'ReliefWeb terms (snippet + link only)', 'via ReliefWeb (OCHA)', 'https://reliefweb.int', FALSE, FALSE, 'daily',
   ARRAY['UKR','POL','MDA','ROU','SVK','HUN'])
ON CONFLICT (slug) DO NOTHING;
