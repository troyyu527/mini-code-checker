// QA report: what report.json holds (rules, findings, agent trace). zod checks the file when it is loaded.
import { z } from "zod";
import { OPERATORS, RequirementSchema } from "./requirement";
import { formatFact } from "./units";

export const SEVERITIES = ["major", "minor"] as const;
export type Severity = (typeof SEVERITIES)[number];

export const FindingSchema = z.object({
  id: z.string(),
  requirementId: z.string(),
  globalId: z.string(),
  element: z.string(),
  ifcType: z.string(),
  storey: z.string().nullable(),
  quantity: z.string(),
  observed: z.number(),
  limit: z.number(),
  op: z.enum(OPERATORS),
  severity: z.enum(SEVERITIES),
});
export type Finding = z.infer<typeof FindingSchema>;

export const TraceEntrySchema = z.object({
  agent: z.string(),
  summary: z.string(),
  ms: z.number().nonnegative(),
});
export type TraceEntry = z.infer<typeof TraceEntrySchema>;

export const ReportSchema = z.object({
  version: z.literal(1),
  sampleId: z.string(),
  generatedAt: z.string(),
  /** "hand-written rules", or the LLM that wrote the rules. */
  rulesBy: z.string(),
  requirements: z.array(RequirementSchema),
  findings: z.array(FindingSchema),
  /** Elements a rule applies to but that have no value for its quantity. */
  notEvaluated: z.number().int().nonnegative(),
  trace: z.array(TraceEntrySchema),
});
export type Report = z.infer<typeof ReportSchema>;

const OP_TEXT = { ">=": "at least", "<=": "at most", ">": "more than", "<": "less than" } as const;

/** One line for the report and the chat, e.g. "762 mm (30 in); required at least 812.8 mm (32 in)". */
export function describeFinding(f: Pick<Finding, "observed" | "limit" | "op" | "quantity">): string {
  return `${formatFact(f.observed, f.quantity)}; required ${OP_TEXT[f.op]} ${formatFact(f.limit, f.quantity)}`;
}