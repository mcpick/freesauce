CREATE TABLE IF NOT EXISTS shops (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  sauce_types TEXT DEFAULT 'tomato',
  submitted_by TEXT,
  verified INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  suburb TEXT,
  state TEXT
);

CREATE INDEX IF NOT EXISTS idx_shops_state ON shops(state);
CREATE INDEX IF NOT EXISTS idx_shops_verified ON shops(verified);

-- Seed some known legends
INSERT INTO shops (name, address, lat, lng, sauce_types, verified, suburb, state) VALUES
  ('Vili''s', '501 Port Rd, West Hindmarsh SA 5007', -34.9084, 138.5660, 'tomato,bbq,chilli', 1, 'West Hindmarsh', 'SA'),
  ('Harry''s Cafe de Wheels', 'Cowper Wharf Roadway, Woolloomooloo NSW 2011', -33.8706, 151.2260, 'tomato,mushy peas', 1, 'Woolloomooloo', 'NSW'),
  ('Pie in the Sky', '1858 Bells Line of Rd, Bilpin NSW 2758', -33.4944, 150.5347, 'tomato,bbq', 1, 'Bilpin', 'NSW'),
  ('Upper Crust Pies', '340 Unley Rd, Hyde Park SA 5061', -34.9530, 138.6040, 'tomato,bbq,chilli', 1, 'Hyde Park', 'SA'),
  ('Bourke Street Bakery', '633 Bourke St, Surry Hills NSW 2010', -33.8832, 151.2108, 'tomato', 1, 'Surry Hills', 'NSW'),
  ('Tooborac Hotel & Brewery', '2511 Northern Hwy, Tooborac VIC 3522', -37.0500, 144.8000, 'tomato,bbq', 1, 'Tooborac', 'VIC'),
  ('Yatala Pies', '865 Old Pacific Hwy, Yatala QLD 4207', -27.7286, 153.2364, 'tomato,bbq,chilli', 1, 'Yatala', 'QLD'),
  ('Jesters Pies', '731 Hay St, Perth WA 6000', -31.9505, 115.8605, 'tomato,bbq', 1, 'Perth', 'WA');
