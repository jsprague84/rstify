CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    application_id INTEGER REFERENCES applications(id) ON DELETE CASCADE,
    topic_id INTEGER REFERENCES topics(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    title TEXT,
    message TEXT NOT NULL,
    priority INTEGER NOT NULL DEFAULT 5,
    tags TEXT,
    click_url TEXT,
    icon_url TEXT,
    actions TEXT,
    extras TEXT,
    content_type TEXT DEFAULT 'text/plain',
    scheduled_for TEXT,
    delivered_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    CHECK (
        (application_id IS NOT NULL AND topic_id IS NULL) OR
        (application_id IS NULL AND topic_id IS NOT NULL)
    )
);
