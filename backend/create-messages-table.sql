-- Messages table for student <-> instructor chat
-- Run this on your Supabase database (SQL editor or Management API).

CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT messages_no_self CHECK (sender_id <> recipient_id)
);

-- Lookup indexes
CREATE INDEX IF NOT EXISTS idx_messages_sender_created
  ON messages(sender_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_recipient_created
  ON messages(recipient_id, created_at DESC);

-- Conversation pair index (uses ordered pair so both directions hit the same key)
CREATE INDEX IF NOT EXISTS idx_messages_pair
  ON messages (
    LEAST(sender_id, recipient_id),
    GREATEST(sender_id, recipient_id),
    created_at DESC
  );

-- Unread lookup
CREATE INDEX IF NOT EXISTS idx_messages_unread
  ON messages(recipient_id)
  WHERE read_at IS NULL;

-- Service role talks to the table directly via JWT-auth backend
ALTER TABLE messages DISABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';
