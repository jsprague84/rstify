-- Add FCM registration token to clients for push notifications
ALTER TABLE clients ADD COLUMN fcm_token TEXT;
CREATE INDEX IF NOT EXISTS idx_clients_fcm_token ON clients(fcm_token) WHERE fcm_token IS NOT NULL;
