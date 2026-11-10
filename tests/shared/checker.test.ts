import { describe, expect, it } from "vitest";
import { check } from "@shared/checker";
import type { ElementFacts } from "@shared/elementFacts";
import { makeRequirement } from "@shared/requirement";

const door = (name: string, dims: Record<string, number>, objectType: string | null = null): ElementFacts => ({
  globalId: `${name}`.padEnd(22, "x"),
  expressId: 1,
  ifcType: "IfcDoor",
  name,
  longName: null,
  objectType,
  storey: "Level 1",
  dims,
});

const doorWidth = makeRequirement({
  id: "R-01",
  title: "Door clear width at least 32 in",
  appliesTo: "IfcDoor",
  where: [],
  quantity: "clearWidthMm",
  op: ">=",
  value: 32,
  unit: "in",
  citation: { chunkId: "S022#051", section: "1010.1.1.1", page: 21, sourceUrl: "https://example.org", quote: "a minimum clear width of 32 inches" },
});

describe("check: boundary values of the 32 in (812.8 mm) door rule", () => {
  it.each([
    [812.7, "failed"], // just below the limit: last invalid value
    [812.8, "passed"], // on the limit: first valid value
    [812.9, "passed"], // just above: valid values continue
    [813, "passed"], // D-105 in the sample model
  ])("%s mm → %s", (width, status) => {
    expect(check(doorWidth, [door("D", { clearWidthMm: width })])[0].status).toBe(status);
  });

  it("a door without a width is not evaluated, not failed (unknown is not too small)", () => {
    const [r] = check(doorWidth, [door("D", {})]);
    expect(r).toMatchObject({ status: "not_evaluated", observed: null });
  });

  it("an element of another type is not checked at all", () => {
    expect(check(doorWidth, [{ ...door("W", { clearWidthMm: 500 }), ifcType: "IfcWindow" }])).toEqual([]);
  });

  it("not_in conditions skip the listed kinds, compared without case", () => {
    const rule = { ...doorWidth, where: [{ field: "objectType" as const, op: "not_in" as const, values: ["closet"] }] };
    const results = check(rule, [door("A", { clearWidthMm: 600 }, "Closet"), door("B", { clearWidthMm: 600 }, "Office")]);
    expect(results.map((r) => r.globalId[0])).toEqual(["B"]);
  });

  it("an empty model gives no results", () => {
    expect(check(doorWidth, [])).toEqual([]);
  });
});
