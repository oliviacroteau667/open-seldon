-- Add reply threading to messages table.
-- reply_to_id references the Telegram message ID this message replies to.
-- NULL means it is a root (top-level) message.
ALTER TABLE messages
    ADD COLUMN IF NOT EXISTS reply_to_id BIGINT REFERENCES messages(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_messages_reply_to
    ON messages (reply_to_id)
    WHERE reply_to_id IS NOT NULL;
