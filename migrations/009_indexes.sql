-- Performance indexes for common query patterns

-- Messages: queries by application, topic, user, and scheduled delivery
CREATE INDEX IF NOT EXISTS idx_messages_application_id ON messages(application_id);
CREATE INDEX IF NOT EXISTS idx_messages_topic_id ON messages(topic_id);
CREATE INDEX IF NOT EXISTS idx_messages_user_id ON messages(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_scheduled_for ON messages(scheduled_for)
    WHERE scheduled_for IS NOT NULL AND delivered_at IS NULL;

-- Attachments: lookup by message and cleanup of expired entries
CREATE INDEX IF NOT EXISTS idx_attachments_message_id ON attachments(message_id);
CREATE INDEX IF NOT EXISTS idx_attachments_expires_at ON attachments(expires_at)
    WHERE expires_at IS NOT NULL;

-- Webhook configs: lookup by user
CREATE INDEX IF NOT EXISTS idx_webhook_configs_user_id ON webhook_configs(user_id);

-- Applications: lookup by user (used in message listing joins)
CREATE INDEX IF NOT EXISTS idx_applications_user_id ON applications(user_id);

-- Clients: lookup by user
CREATE INDEX IF NOT EXISTS idx_clients_user_id ON clients(user_id);

-- Topic permissions: lookup by user
CREATE INDEX IF NOT EXISTS idx_topic_permissions_user_id ON topic_permissions(user_id);
