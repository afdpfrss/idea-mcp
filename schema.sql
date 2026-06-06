CREATE TABLE IF NOT EXISTS ideas (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'seed',
  impact      INTEGER NOT NULL DEFAULT 3,
  confidence  INTEGER NOT NULL DEFAULT 3,
  effort      INTEGER NOT NULL DEFAULT 3,
  category    TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ideas_status   ON ideas(status);
CREATE INDEX IF NOT EXISTS idx_ideas_category ON ideas(category);
