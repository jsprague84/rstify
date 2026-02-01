CREATE TABLE IF NOT EXISTS webhook_configs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    token TEXT UNIQUE NOT NULL,
    webhook_type TEXT NOT NULL,
    target_topic_id INTEGER REFERENCES topics(id),
    target_application_id INTEGER REFERENCES applications(id),
    template TEXT NOT NULL,
    enabled BOOLEAN DEFAULT TRUE,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
