-- Telegram channels the daily pipeline scrapes. Idempotent: safe to re-run on a live DB.
CREATE TABLE IF NOT EXISTS channels (
    name            TEXT PRIMARY KEY,               -- Telegram username, e.g. polska_grupa_informacyjna
    enabled         BOOLEAN NOT NULL DEFAULT TRUE,
    note            TEXT,
    added_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_scraped_at TIMESTAMPTZ,
    last_message_at TIMESTAMPTZ
);

-- Seed from whatever has already been scraped
INSERT INTO channels (name, last_message_at)
SELECT channel_name, MAX(date) FROM messages GROUP BY channel_name
ON CONFLICT (name) DO NOTHING;
