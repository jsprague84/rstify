-- Speeds up message search (ORDER BY created_at DESC), since/until range filters,
-- count_since, and the retention-cleanup scan — all of which sort/filter on
-- messages.created_at and previously did full table scans as the table grew.
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);

-- Drop the duplicate topic_permissions(user_id) index: migration 009 already
-- created idx_topic_permissions_user_id on the same column, so 013's
-- idx_topic_permissions_user was pure write overhead.
DROP INDEX IF EXISTS idx_topic_permissions_user;
