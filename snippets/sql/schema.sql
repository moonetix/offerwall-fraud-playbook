-- Reference schema for the playbook. SQLite dialect; types map directly to
-- PostgreSQL and MySQL. Times are Unix seconds. Money is integer micro-units
-- (1 coin = 1000000) so sums stay exact.

CREATE TABLE users (
  id             TEXT PRIMARY KEY,
  created_at     INTEGER NOT NULL,
  referred_by    TEXT REFERENCES users(id),
  country        TEXT,
  signup_ip      TEXT,
  signup_network TEXT            -- e.g. 203.0.113.0/24 or the first /48 of an IPv6 address
);

CREATE TABLE user_devices (
  user_id    TEXT NOT NULL REFERENCES users(id),
  device_id  TEXT NOT NULL,      -- an ID your app creates, never a hardware identifier
  first_seen INTEGER NOT NULL,
  PRIMARY KEY (user_id, device_id)
);

CREATE TABLE payout_destinations (
  user_id          TEXT NOT NULL REFERENCES users(id),
  method           TEXT NOT NULL,
  destination_hash TEXT NOT NULL, -- HMAC of the normalized address, not the address
  first_used       INTEGER NOT NULL,
  PRIMARY KEY (user_id, method, destination_hash)
);

CREATE TABLE reward_ledger (
  transaction_id TEXT PRIMARY KEY,  -- the network's transaction ID; the unique key is the idempotency guarantee
  user_id        TEXT NOT NULL,
  offer_id       TEXT,
  amount_micros  INTEGER NOT NULL CHECK (amount_micros >= 0),
  state          TEXT NOT NULL CHECK (state IN ('held', 'available', 'reversed')),
  credited_at    INTEGER,
  release_at     INTEGER,
  released_at    INTEGER,
  reversed_at    INTEGER
);
CREATE INDEX reward_ledger_user ON reward_ledger (user_id, state);
CREATE INDEX reward_ledger_release ON reward_ledger (state, release_at);

CREATE TABLE referral_commissions (
  source_transaction_id TEXT PRIMARY KEY REFERENCES reward_ledger(transaction_id),
  referrer_id           TEXT NOT NULL,
  amount_micros         INTEGER NOT NULL CHECK (amount_micros >= 0),
  state                 TEXT NOT NULL CHECK (state IN ('available', 'reversed')),
  created_at            INTEGER NOT NULL,
  reversed_at           INTEGER
);

CREATE TABLE cashouts (
  id               INTEGER PRIMARY KEY,
  user_id          TEXT NOT NULL,
  amount_micros    INTEGER NOT NULL CHECK (amount_micros > 0),
  method           TEXT NOT NULL,
  destination_hash TEXT NOT NULL,
  state            TEXT NOT NULL CHECK (state IN ('pending', 'approved', 'paid', 'rejected')),
  requested_at     INTEGER NOT NULL,
  decided_at       INTEGER
);

CREATE TABLE postback_log (
  id           INTEGER PRIMARY KEY,
  received_at  INTEGER NOT NULL,
  remote_ip    TEXT,
  query        TEXT NOT NULL,      -- raw query string, exactly as received
  signature_ok INTEGER NOT NULL,
  outcome      TEXT NOT NULL,      -- credited, reversed, duplicate, ignored, rejected
  http_status  INTEGER NOT NULL
);

CREATE TABLE risk_events (
  id         INTEGER PRIMARY KEY,
  user_id    TEXT,
  kind       TEXT NOT NULL,        -- signup, login, wall_open, cashout_request, network_flag, ...
  detail     TEXT,                 -- JSON
  created_at INTEGER NOT NULL
);
CREATE INDEX risk_events_user ON risk_events (user_id, created_at);

CREATE TABLE review_queue (
  id           INTEGER PRIMARY KEY,
  subject_type TEXT NOT NULL CHECK (subject_type IN ('user', 'cluster', 'cashout')),
  subject_id   TEXT NOT NULL,
  reasons      TEXT NOT NULL,      -- JSON array of signal names
  priority     INTEGER NOT NULL,
  state        TEXT NOT NULL CHECK (state IN ('open', 'decided')),
  opened_at    INTEGER NOT NULL,
  decided_at   INTEGER,
  decision     TEXT,               -- release, hold, verify, reject, close
  decided_by   TEXT,
  note         TEXT
);
CREATE UNIQUE INDEX review_queue_open ON review_queue (subject_type, subject_id) WHERE state = 'open';
