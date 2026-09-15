-- Enable pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- Raw scraped messages
CREATE TABLE IF NOT EXISTS messages (
    id              BIGINT PRIMARY KEY,
    channel_id      TEXT NOT NULL,
    channel_name    TEXT NOT NULL,
    date            TIMESTAMPTZ NOT NULL,
    raw_text        TEXT,
    media_type      TEXT DEFAULT 'text',  -- text | image | video | document
    media_path      TEXT,                 -- local path or blob URL
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Processed / enriched messages
CREATE TABLE IF NOT EXISTS processed_messages (
    id                  BIGINT PRIMARY KEY REFERENCES messages(id) ON DELETE CASCADE,
    detected_language   TEXT,
    translation         TEXT,
    media_description   TEXT,            -- Claude vision output for images/video
    categories          TEXT[],          -- IOM taxonomy labels
    locations           TEXT[],          -- raw extracted location strings
    geocoded_locations  JSONB,           -- [{name, lat, lon, confidence}]
    embedding           vector(384),     -- all-MiniLM-L6-v2
    processed_at        TIMESTAMPTZ DEFAULT NOW(),
    curated             BOOLEAN DEFAULT FALSE  -- human-reviewed; never overwritten by pipeline
);

-- Index for semantic search
CREATE INDEX IF NOT EXISTS idx_embedding_cosine
    ON processed_messages USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

-- Index for category filtering
CREATE INDEX IF NOT EXISTS idx_categories
    ON processed_messages USING GIN (categories);

-- Index for geo filtering
CREATE INDEX IF NOT EXISTS idx_geocoded
    ON processed_messages USING GIN (geocoded_locations);

-- Index for date range queries
CREATE INDEX IF NOT EXISTS idx_messages_date
    ON messages (date);

CREATE INDEX IF NOT EXISTS idx_messages_channel
    ON messages (channel_name);
