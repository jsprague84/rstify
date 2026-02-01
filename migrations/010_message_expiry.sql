-- Message expiry support
ALTER TABLE messages ADD COLUMN expires_at TEXT;
ALTER TABLE topics ADD COLUMN cache_duration TEXT;
