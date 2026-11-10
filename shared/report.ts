// QA report: what report.json holds (rules, findings, agent trace), and how findings are made from check results.
import { z } from "zod";
import { check } from "./checker";
import type { ElementFacts } from "./elementFacts";
import { type Requirement, RequirementSchema } from "./requirement";
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
  op: RequirementSchema.shape.op,
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

/** A shortfall of 10 % of the limit or more is major; less is minor. */
export const MAJOR_SHORTFALL = 0.1;

export function severityOf(observed: number, limit: number): Severity {
  return Math.abs(limit - observed) / limit >= MAJOR_SHORTFALL - 1e-9 ? "major" : "minor";
}

/** Runs every requirement on the facts and turns each failure into a numbered finding. */
export function buildReport(input: {
  sampleId: string;
  rulesBy: string;
  requirements: Requirement[];
  facts: ElementFacts[];
  trace?: TraceEntry[];
  now?: Date;
}): Report {
  const byId = new Map(input.facts.map((f) => [f.globalId, f]));
  const findings: Finding[] = [];
  let notEvaluated = 0;
  for (const req of input.requirements) {
    for (const r of check(req, input.facts)) {
      if (r.status === "not_evaluated") notEvaluated++;
      if (r.status !== "failed" || r.observed === null) continue;
      const f = byId.get(r.globalId)!;
      findings.push({
        id: `F-${String(findings.length + 1).padStart(2, "0")}`,
        requirementId: req.id,
        globalId: f.globalId,
        element: f.name ?? f.longName ?? f.globalId,
        ifcType: f.ifcType,
        storey: f.storey,
        quantity: req.quantity,
        observed: r.observed,
        limit: r.limit,
        op: req.op,
        severity: severityOf(r.observed, r.limit),
      });
    }
  }
  return {
    version: 1,
    sampleId: input.sampleId,
    generatedAt: (input.now ?? new Date()).toISOString(),
    rulesBy: input.rulesBy,
    requirements: input.requirements,
    findings,
    notEvaluated,
    trace: input.trace ?? [],
  };
}

const OP_TEXT = { ">=": "at least", "<=": "at most", ">": "more than", "<": "less than" } as const;

/** One line for the report and the chat, e.g. "762 mm (30 in); required at least 812.8 mm (32 in)". */
export function describeFinding(f: Pick<Finding, "observed" | "limit" | "op" | "quantity">): string {
  return `${formatFact(f.observed, f.quantity)}; required ${OP_TEXT[f.op]} ${formatFact(f.limit, f.quantity)}`;
}
