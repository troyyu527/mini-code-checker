// Evaluation: scores that compare what the AI produced with answers written down beforehand (a golden set).
// Pure functions: the CLIs feed them real results, the tests feed them hand-made ones.

/** A found provision counts if it is the expected one or one of its sub-provisions (1010.1.1 → 1010.1.1.1). */
export function matchesProvision(found: string, expected: string): boolean {
  return found === expected || found.startsWith(`${expected}.`);
}

/** Position (1, 2, …) of the first result that has an expected provision; null when none of them has. */
export function firstHitRank(results: string[][], expect: string[]): number | null {
  const i = results.findIndex((provisions) => provisions.some((p) => expect.some((e) => matchesProvision(p, e))));
  return i < 0 ? null : i + 1;
}

export interface SearchScore {
  questions: number;
  /** Share of questions whose first result is right. */
  hitAt1: number;
  /** Share of questions with a right result among the first 5. */
  hitAt5: number;
  /** Mean reciprocal rank: 1 for rank 1, 1/2 for rank 2 …, 0 when not found. */
  mrr: number;
}

export function scoreSearch(ranks: (number | null)[]): SearchScore {
  const n = ranks.length || 1;
  const share = (ok: (r: number) => boolean) => ranks.filter((r) => r !== null && ok(r)).length / n;
  return {
    questions: ranks.length,
    hitAt1: share((r) => r === 1),
    hitAt5: share((r) => r <= 5),
    mrr: ranks.reduce<number>((sum, r) => sum + (r ? 1 / r : 0), 0) / n,
  };
}

export interface DetectionScore {
  truePositives: string[];
  falsePositives: string[];
  falseNegatives: string[];
  precision: number;
  recall: number;
}

/**
 * Found vs expected element ids. Precision: how many of the reported problems are real.
 * Recall: how many of the real problems were reported.
 */
export function scoreDetection(found: string[], expected: string[]): DetectionScore {
  const f = new Set(found);
  const e = new Set(expected);
  const truePositives = [...f].filter((x) => e.has(x));
  const falsePositives = [...f].filter((x) => !e.has(x));
  const falseNegatives = [...e].filter((x) => !f.has(x));
  return {
    truePositives,
    falsePositives,
    falseNegatives,
    precision: f.size ? truePositives.length / f.size : 1,
    recall: e.size ? truePositives.length / e.size : 1,
  };
}
