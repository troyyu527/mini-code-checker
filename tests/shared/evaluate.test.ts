import { describe, expect, it } from "vitest";
import { firstHitRank, matchesProvision, scoreDetection, scoreSearch } from "@shared/evaluate";

describe("search scores", () => {
  it("counts a sub-provision as a hit, but not a neighbour", () => {
    expect(matchesProvision("1010.1.1.1", "1010.1.1")).toBe(true);
    expect(matchesProvision("1010.1.10", "1010.1.1")).toBe(false); // not a sub-provision, just starts with the same digits
  });
  it("finds the rank of the first right result", () => {
    expect(firstHitRank([["1017.3"], ["1017.2"]], ["1017.2"])).toBe(2);
    expect(firstHitRank([["1017.3"]], ["1017.2"])).toBeNull();
  });
  it("turns ranks into hit@1, hit@5 and MRR", () => {
    expect(scoreSearch([1, 2, null, 6])).toEqual({ questions: 4, hitAt1: 0.25, hitAt5: 0.5, mrr: (1 + 1 / 2 + 0 + 1 / 6) / 4 });
  });
});

describe("detection scores", () => {
  it("precision: how many reported problems are real; recall: how many real problems were reported", () => {
    const s = scoreDetection(["D-104", "D-107", "D-999"], ["D-104", "D-107", "105", "109"]);
    expect(s).toMatchObject({ truePositives: ["D-104", "D-107"], falsePositives: ["D-999"], falseNegatives: ["105", "109"] });
    expect(s.precision).toBeCloseTo(2 / 3);
    expect(s.recall).toBeCloseTo(2 / 4);
  });
  it("reporting nothing is never wrong, but finds nothing", () => {
    expect(scoreDetection([], ["D-104"])).toMatchObject({ precision: 1, recall: 0 });
  });
});
