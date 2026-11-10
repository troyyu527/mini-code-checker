-- D1 schema of the Mini Code Checker. Safe to run again: every statement has IF NOT EXISTS.

-- Element facts of the sample model (npm run seed).
CREATE TABLE IF NOT EXISTS elements (
  global_id  TEXT PRIMARY KEY,
  ifc_type   TEXT NOT NULL,
  name       TEXT,
  storey     TEXT,
  facts_json TEXT NOT NULL -- ElementFacts (shared/elementFacts.ts)
);

-- Rules and findings of the QA report (npm run seed copies them from report.json).
CREATE TABLE IF NOT EXISTS requirements (
  id   TEXT PRIMARY KEY,
  json TEXT NOT NULL -- Requirement (shared/requirement.ts)
);

CREATE TABLE IF NOT EXISTS findings (
  id             TEXT PRIMARY KEY,
  requirement_id TEXT NOT NULL,
  global_id      TEXT NOT NULL,
  element        TEXT NOT NULL,
  json           TEXT NOT NULL -- Finding (shared/report.ts)
);
CREATE INDEX IF NOT EXISTS findings_by_element ON findings (global_id);
-- Code clauses (npm run ingest). The text stays in D1; the app shows short quotes only.
CREATE TABLE IF NOT EXISTS code_chunks (
  id         TEXT PRIMARY KEY, -- e.g. S022#051
  section    TEXT NOT NULL,
  heading    TEXT NOT NULL,    -- the context line before the clause text
  provisions TEXT NOT NULL,    -- JSON array, e.g. ["1010.1.1.1"]
  page       INTEGER,
  source_url TEXT NOT NULL,
  body       TEXT NOT NULL,
  text_hash  TEXT NOT NULL     -- write again only when the text changes
);

-- Keyword index (SQLite FTS5) over the same clauses.
CREATE VIRTUAL TABLE IF NOT EXISTS code_chunks_fts USING fts5 (id UNINDEXED, heading, provisions, body);

-- Local vector index (deployed: Vectorize): one embedding per clause, as JSON text.
CREATE TABLE IF NOT EXISTS code_vectors (
  id     TEXT PRIMARY KEY,
  vector TEXT NOT NULL
);
