CREATE TABLE leads (
  id TEXT PRIMARY KEY,
  payload_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  note TEXT NOT NULL,
  locale TEXT NOT NULL,
  campaign TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'sending', 'mail_accepted')),
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt INTEGER NOT NULL,
  lease_until INTEGER,
  lease_id TEXT,
  mail_id TEXT,
  mail_accepted_at INTEGER,
  last_error TEXT
);
CREATE INDEX leads_outbox ON leads(status, next_attempt);
CREATE INDEX leads_created ON leads(created_at);
CREATE INDEX leads_phone_created ON leads(phone, created_at);
CREATE INDEX leads_retention ON leads(mail_accepted_at);
-- These checks execute atomically with INSERT, including concurrent requests.
-- Pending requests are never discarded to make room for new requests.
CREATE TRIGGER leads_capacity BEFORE INSERT ON leads
WHEN NOT EXISTS (SELECT 1 FROM leads WHERE id = NEW.id)
BEGIN
  SELECT RAISE(ABORT, 'LEAD_PHONE_LIMIT') WHERE (SELECT count(*) FROM leads WHERE phone = NEW.phone AND created_at > NEW.created_at - 3600000) >= 3;
  SELECT RAISE(ABORT, 'LEAD_CAPACITY') WHERE (SELECT count(*) FROM leads WHERE created_at > NEW.created_at - 3600000) >= 200;
  SELECT RAISE(ABORT, 'LEAD_CAPACITY') WHERE (SELECT count(*) FROM leads WHERE status != 'mail_accepted') >= 1000;
END;
