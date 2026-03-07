ALTER TABLE clients ADD COLUMN scopes TEXT NOT NULL DEFAULT '["read","write"]';
