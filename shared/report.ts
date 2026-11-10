// QA report: the shape of report.json. Plain TypeScript types for now; lesson 14 turns them into zod schemas.
import { formatFact } from "./units";

export const SEVERITIES = ["major", "minor"] as const;
export type Severity = (typeof SEVERITIES)[number];
export type Operator = ">=" | "<=" | ">" | "<";

/** One code rule (lesson 19 adds the fields the checker needs). */
export interface Requirement {
  id: string;
  title: string;
  citation: { section: string; quote: string };
}

export interface Finding {
  id: string;
  requirementId: string;
  globalId: string;
  element: string;
  ifcType: string;
  storey: string | null;
  quantity: string;
  observed: number;
  limit: number;
  op: Operator;
  severity: Severity;
}

export interface TraceEntry {
  agent: string;
  summary: string;
  ms: number;
}

export interface Report {
  version: 1;
  sampleId: string;
  generatedAt: string;
  rulesBy: string;
  requirements: Requirement[];
  findings: Finding[];
  notEvaluated: number;
  trace: TraceEntry[];
}

const OP_TEXT = { ">=": "at least", "<=": "at most", ">": "more than", "<": "less than" } as const;

/** One line for the report and the chat, e.g. "762 mm (30 in); required at least 812.8 mm (32 in)". */
export function describeFinding(f: Pick<Finding, "observed" | "limit" | "op" | "quantity">): string {
  return `${formatFact(f.observed, f.quantity)}; required ${OP_TEXT[f.op]} ${formatFact(f.limit, f.quantity)}`;
}