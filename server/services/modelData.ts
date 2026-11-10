// D1 access for the model data: element facts, and the rules and findings of the QA report.
import type { ElementFacts } from "@shared/elementFacts";
import type { Finding, Report } from "@shared/report";
import type { Requirement } from "@shared/requirement";

/** Runs a .sql file. D1's exec() treats each line as a statement, so we split on ";" and send one batch instead. */
export async function applySchema(db: D1Database, schemaSql: string): Promise<void> {
  const statements = schemaSql
    .replace(/--.*$/gm, "")
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
  await db.batch(statements.map((s) => db.prepare(s)));
}

/** Replaces all elements and the report in one batch: a batch is one transaction, all or nothing. */
export async function saveModelAndReport(db: D1Database, facts: ElementFacts[], report: Report): Promise<void> {
  const element = db.prepare("INSERT INTO elements (global_id, ifc_type, name, storey, facts_json) VALUES (?, ?, ?, ?, ?)");
  const req = db.prepare("INSERT INTO requirements (id, json) VALUES (?, ?)");
  const finding = db.prepare("INSERT INTO findings (id, requirement_id, global_id, element, json) VALUES (?, ?, ?, ?, ?)");
  await db.batch([
    ...["elements", "requirements", "findings"].map((t) => db.prepare(`DELETE FROM ${t}`)),
    ...facts.map((f) => element.bind(f.globalId, f.ifcType, f.name, f.storey, JSON.stringify(f))),
    ...report.requirements.map((r) => req.bind(r.id, JSON.stringify(r))),
    ...report.findings.map((f) => finding.bind(f.id, f.requirementId, f.globalId, f.element, JSON.stringify(f))),
  ]);
}

export async function getFacts(db: D1Database): Promise<ElementFacts[]> {
  const { results } = await db.prepare("SELECT facts_json FROM elements ORDER BY ifc_type, name").all<{ facts_json: string }>();
  return results.map((r) => JSON.parse(r.facts_json) as ElementFacts);
}

export interface FindingWithRule {
  finding: Finding;
  requirement: Requirement | null;
}

/** All findings, or only those of some elements, each with the rule it failed. */
export async function getFindings(db: D1Database, globalIds?: string[]): Promise<FindingWithRule[]> {
  const { results } = await db
    .prepare(
      `SELECT f.json AS finding, r.json AS requirement FROM findings f
       LEFT JOIN requirements r ON r.id = f.requirement_id ORDER BY f.id`,
    )
    .all<{ finding: string; requirement: string | null }>();
  const wanted = globalIds && new Set(globalIds);
  return results
    .map((r) => ({ finding: JSON.parse(r.finding) as Finding, requirement: r.requirement ? (JSON.parse(r.requirement) as Requirement) : null }))
    .filter(({ finding }) => !wanted || wanted.has(finding.globalId));
}
