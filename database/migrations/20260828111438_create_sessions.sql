-- Migration: create sessions table for Turso (SQLite/libSQL)
-- Timestamp: 20260828111438
-- id: UUID v7 TEXT PK, user_id FK -> users(id), session_token UNIQUE, expires_at, created_at, updated_at

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY NOT NULL, -- UUID v7 via Bun.randomUUIDv7()
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_token TEXT NOT NULL UNIQUE, -- 16 char a16 or secure random
  expires_at TEXT NOT NULL, -- ISO8601 e.g. strftime('%Y-%m-%dT%H:%M:%fZ','now','+7 days')
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;

-- Index for lookup by session_token (UNIQUE already indexed, explicit)
CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_token ON sessions(session_token);

-- Index for user_id for JOIN/auth checks
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);

-- Index for expires_at for cleanup of expired sessions
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

-- Trigger to auto-update updated_at on row update
CREATE TRIGGER IF NOT EXISTS trg_sessions_updated_at
AFTER UPDATE ON sessions
FOR EACH ROW
WHEN NEW.updated_at = OLD.updated_at
BEGIN
  UPDATE sessions SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = NEW.id;
END;
