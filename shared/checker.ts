// Checker: evaluates Requirements on ElementFacts. Deterministic: no AI, same input → same result.
import type { ElementFacts } from "./elementFacts";
import type { Condition, Operator, Requirement } from "./requirement";

export type CheckStatus = "failed" | "passed" | "not_evaluated";

export interface CheckResult {
  requirementId: string;
  globalId: string;
  status: CheckStatus;
  /** null when the element has no value for the quantity. */
  observed: number | null;
  limit: number;
}

// A tiny tolerance, so 812.8 typed in a model and 32 in × 25.4 = 812.8000000001 still count as equal.
const EPS = 1e-9;
export const COMPARE: Record<Operator, (a: number, b: number) => boolean> = {
  ">=": (a, b) => a >= b - EPS,
  "<=": (a, b) => a <= b + EPS,
  ">": (a, b) => a > b + EPS,
  "<": (a, b) => a < b - EPS,
};

export function matchesConditions(f: ElementFacts, where: Condition[]): boolean {
  return where.every((c) => {
    const v = f[c.field]?.toLowerCase() ?? null;
    const hit = v !== null && c.values.some((x) => x.toLowerCase() === v);
    return c.op === "in" ? hit : !hit;
  });
}

/** The elements a requirement applies to: same IFC type and every condition met. */
export function appliesTo(req: Pick<Requirement, "appliesTo" | "where">, facts: ElementFacts[]): ElementFacts[] {
  const type = req.appliesTo.toLowerCase();
  return facts.filter((f) => f.ifcType.toLowerCase() === type && matchesConditions(f, req.where));
}

export function check(req: Requirement, facts: ElementFacts[]): CheckResult[] {
  return appliesTo(req, facts).map((f) => {
    const observed = f.dims[req.quantity];
    if (observed === undefined || !Number.isFinite(observed)) {
      return { requirementId: req.id, globalId: f.globalId, status: "not_evaluated", observed: null, limit: req.limit };
    }
    const ok = COMPARE[req.op](observed, req.limit);
    return { requirementId: req.id, globalId: f.globalId, status: ok ? "passed" : "failed", observed, limit: req.limit };
  });
}
