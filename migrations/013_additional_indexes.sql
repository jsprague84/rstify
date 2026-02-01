-- Additional indexes for query performance
CREATE INDEX IF NOT EXISTS idx_messages_expires_at ON messages(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_messages_scheduled ON messages(scheduled_for, delivered_at) WHERE scheduled_for IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_webhook_configs_token ON webhook_configs(token);
CREATE INDEX IF NOT EXISTS idx_webhook_configs_direction ON webhook_configs(direction, enabled);
CREATE INDEX IF NOT EXISTS idx_topic_permissions_user ON topic_permissions(user_id);
