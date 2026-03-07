-- Full-text search index on messages (title and message columns)
CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
    title,
    message,
    content='messages',
    content_rowid='id'
);

-- Populate FTS index with existing messages
INSERT INTO messages_fts(rowid, title, message)
SELECT id, COALESCE(title, ''), message FROM messages;

-- Triggers to keep FTS index in sync
CREATE TRIGGER IF NOT EXISTS messages_fts_insert AFTER INSERT ON messages BEGIN
    INSERT INTO messages_fts(rowid, title, message) VALUES (new.id, COALESCE(new.title, ''), new.message);
END;

CREATE TRIGGER IF NOT EXISTS messages_fts_update AFTER UPDATE ON messages BEGIN
    INSERT INTO messages_fts(messages_fts, rowid, title, message) VALUES ('delete', old.id, COALESCE(old.title, ''), old.message);
    INSERT INTO messages_fts(rowid, title, message) VALUES (new.id, COALESCE(new.title, ''), new.message);
END;

CREATE TRIGGER IF NOT EXISTS messages_fts_delete AFTER DELETE ON messages BEGIN
    INSERT INTO messages_fts(messages_fts, rowid, title, message) VALUES ('delete', old.id, COALESCE(old.title, ''), old.message);
END;
