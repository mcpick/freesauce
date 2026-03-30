-- Add new columns to shops table for v2
ALTER TABLE shops ADD COLUMN slug TEXT;
ALTER TABLE shops ADD COLUMN photo_key TEXT;

-- Create votes table
CREATE TABLE votes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shop_id INTEGER NOT NULL REFERENCES shops(id),
  email TEXT NOT NULL,
  vote TEXT NOT NULL CHECK(vote IN ('up', 'down')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'confirmed')),
  token TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  confirmed_at TEXT,
  UNIQUE(shop_id, email)
);

-- Create indexes for votes table
CREATE INDEX idx_votes_shop ON votes(shop_id, status);
CREATE INDEX idx_votes_token ON votes(token);