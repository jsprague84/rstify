ALTER TABLE topics ADD COLUMN notify_policy TEXT NOT NULL DEFAULT 'always';
ALTER TABLE topics ADD COLUMN notify_priority_min INTEGER DEFAULT 0;
ALTER TABLE topics ADD COLUMN notify_condition TEXT;
ALTER TABLE topics ADD COLUMN notify_digest_interval INTEGER;
ALTER TABLE topics ADD COLUMN store_policy TEXT NOT NULL DEFAULT 'all';
ALTER TABLE topics ADD COLUMN store_interval INTEGER;
