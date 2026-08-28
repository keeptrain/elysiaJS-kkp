-- Migration: create users table for Turso (SQLite/libSQL)
-- Timestamp: 20260828104719
-- id: UUID v7 as TEXT (generated in app via Bun.randomUUIDv7())
-- email: TEXT UNIQUE
-- created_at / updated_at: DATETIME (TEXT ISO8601) with defaults

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY NOT NULL, -- UUID v7, e.g. 0195f3d0-... (generated via Bun.randomUUIDv7())
  email TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;

-- Index for email lookup (UNIQUE already creates index, this is explicit for query planner)
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Trigger to auto-update updated_at on row update (Turso/SQLite)
CREATE TRIGGER IF NOT EXISTS trg_users_updated_at
AFTER UPDATE ON users
FOR EACH ROW
WHEN NEW.updated_at = OLD.updated_at
BEGIN
  UPDATE users SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = NEW.id;
END;
