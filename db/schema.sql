-- Job Search Tracker — SQLite Schema
-- IDs: lower(hex(randomblob(8))) for all new records

PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS companies (
  id       TEXT PRIMARY KEY,
  name     TEXT NOT NULL,
  website  TEXT
);

CREATE TABLE IF NOT EXISTS job_postings (
  id           TEXT PRIMARY KEY,
  company_id   TEXT REFERENCES companies(id),
  title        TEXT NOT NULL,
  link         TEXT,
  source       TEXT,    -- YC, HN, RemoteOK, Wellfound, Builtin
  scraped_date TEXT,    -- ISO date YYYY-MM-DD
  status       TEXT NOT NULL DEFAULT 'new',  -- new / applied / dropped
  description  TEXT
);

CREATE TABLE IF NOT EXISTS events (
  id    TEXT PRIMARY KEY,
  name  TEXT NOT NULL,
  date  TEXT,   -- ISO date YYYY-MM-DD
  notes TEXT
);

CREATE TABLE IF NOT EXISTS contacts (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  company_id    TEXT REFERENCES companies(id),
  role          TEXT,
  source        TEXT,   -- LinkedIn, YC, Cold Email, Referral, Event
  stage         TEXT NOT NULL DEFAULT 'Outreached',  -- Outreached / Responded / Ongoing / Dead
  outreach_date TEXT,   -- ISO date YYYY-MM-DD
  notes         TEXT,
  event_id      TEXT REFERENCES events(id)
);

CREATE TABLE IF NOT EXISTS interactions (
  id         TEXT PRIMARY KEY,
  contact_id TEXT NOT NULL REFERENCES contacts(id),
  date       TEXT NOT NULL,  -- ISO date YYYY-MM-DD
  direction  TEXT NOT NULL,  -- in / out
  notes      TEXT
);

CREATE TABLE IF NOT EXISTS content_posts (
  id          TEXT PRIMARY KEY,
  posted_date TEXT,   -- ISO date YYYY-MM-DD
  title       TEXT,
  impressions INTEGER,
  reactions   INTEGER,
  comments    INTEGER,
  reposts     INTEGER
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_job_postings_company ON job_postings(company_id);
CREATE INDEX IF NOT EXISTS idx_job_postings_status  ON job_postings(status);
CREATE INDEX IF NOT EXISTS idx_job_postings_source  ON job_postings(source);
CREATE INDEX IF NOT EXISTS idx_contacts_stage       ON contacts(stage);
CREATE INDEX IF NOT EXISTS idx_contacts_company     ON contacts(company_id);
CREATE INDEX IF NOT EXISTS idx_interactions_contact ON interactions(contact_id);
CREATE INDEX IF NOT EXISTS idx_interactions_date    ON interactions(date);
