-- Outgoing webhook support
ALTER TABLE webhook_configs ADD COLUMN direction TEXT NOT NULL DEFAULT 'incoming';
ALTER TABLE webhook_configs ADD COLUMN target_url TEXT;
ALTER TABLE webhook_configs ADD COLUMN http_method TEXT NOT NULL DEFAULT 'POST';
ALTER TABLE webhook_configs ADD COLUMN headers TEXT;
ALTER TABLE webhook_configs ADD COLUMN body_template TEXT;
ALTER TABLE webhook_configs ADD COLUMN max_retries INTEGER NOT NULL DEFAULT 3;
ALTER TABLE webhook_configs ADD COLUMN retry_delay_secs INTEGER NOT NULL DEFAULT 10;
