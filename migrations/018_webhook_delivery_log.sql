CREATE TABLE IF NOT EXISTS webhook_delivery_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    webhook_config_id INTEGER NOT NULL REFERENCES webhook_configs(id) ON DELETE CASCADE,
    message_id INTEGER,
    status_code INTEGER,
    response_body_preview TEXT,
    duration_ms INTEGER NOT NULL,
    attempted_at TEXT NOT NULL DEFAULT (datetime('now')),
    success INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_delivery_log_webhook ON webhook_delivery_log(webhook_config_id, attempted_at DESC);
CREATE INDEX idx_delivery_log_age ON webhook_delivery_log(attempted_at);
