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