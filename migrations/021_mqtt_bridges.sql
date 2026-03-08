CREATE TABLE IF NOT EXISTS mqtt_bridges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    remote_url TEXT NOT NULL,
    subscribe_topics TEXT NOT NULL DEFAULT '[]',
    publish_topics TEXT DEFAULT '[]',
    username TEXT,
    password TEXT,
    qos INTEGER DEFAULT 0,
    topic_prefix TEXT,
    auto_create_topics BOOLEAN DEFAULT TRUE,
    enabled BOOLEAN DEFAULT TRUE,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
