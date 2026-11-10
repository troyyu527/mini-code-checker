import { describe, expect, it } from "vitest";
import type { ElementFacts } from "@shared/elementFacts";
import { buildReport, describeFinding, severityOf } from "@shared/report";
import { makeRequirement, RequirementSchema } from "@shared/requirement";
import { formatFact, toFactUnit } from "@shared/units";

const citation = { chunkId: "S024#033", section: "1208.2", page: 13, sourceUrl: "https://example.org", quote: "not less than 7 feet 6 inches (2286 mm)." };

describe("units", () => {
  it("converts code units to the quantity's unit", () => {
    expect(toFactUnit(32, "in", "clearWidthMm")).toBeCloseTo(812.8);
    expect(toFactUnit(7.5, "ft", "ceilingHeightMm")).toBeCloseTo(2286);
    expect(toFactUnit(100, "ft2", "floorAreaM2")).toBeCloseTo(9.29, 2);
  });
  it("refuses a unit that does not fit (inches for an area)", () => {
    expect(toFactUnit(32, "in", "floorAreaM2")).toBeNull();
  });
  it("formats mm with inches", () => {
    expect(formatFact(762, "clearWidthMm")).toBe("762 mm (30 in)");
  });
});

describe("requirements", () => {
  it("makeRequirement calculates the limit from value and unit", () => {
    const r = makeRequirement({ id: "R-02", title: "Ceiling", appliesTo: "IfcSpace", where: [], quantity: "ceilingHeightMm", op: ">=", value: 90, unit: "in", citation });
    expect(r.limit).toBe(2286);
  });
  it("a limit that does not match value × unit is rejected", () => {
    const bad = { id: "R-02", title: "Ceiling", appliesTo: "IfcSpace", where: [], quantity: "ceilingHeightMm", op: ">=", value: 90, unit: "in", limit: 90, citation };
    expect(RequirementSchema.safeParse(bad).success).toBe(false);
  });
  it("makeRequirement refuses a unit that does not fit the quantity", () => {
    expect(() => makeRequirement({ id: "R-03", title: "Area", appliesTo: "IfcSpace", where: [], quantity: "floorAreaM2", op: ">=", value: 70, unit: "in", citation })).toThrow(/does not fit/);
  });
});
describe("severity: 10 % shortfall is the border between minor and major", () => {
  it.each([
    [732, "minor"], // 9.9 % short of 812.8 → minor
    [731.52, "major"], // exactly 10 % short → major
    [711, "major"], // D-107, 12.5 % short
    [762, "minor"], // D-104, 6.25 % short
  ])("%s mm against 812.8 → %s", (observed, sev) => {
    expect(severityOf(observed, 812.8)).toBe(sev);
  });
});

describe("buildReport", () => {
  const rule = makeRequirement({ id: "R-01", title: "Door", appliesTo: "IfcDoor", where: [], quantity: "clearWidthMm", op: ">=", value: 32, unit: "in", citation });
  const fact = (name: string, w?: number): ElementFacts => ({
    globalId: name.padEnd(22, "x"), expressId: 1, ifcType: "IfcDoor", name, longName: null, objectType: null, storey: "L1", dims: w === undefined ? {} : { clearWidthMm: w },
  });
  it("numbers the failures and counts the not evaluated ones", () => {
    const r = buildReport({ sampleId: "t", rulesBy: "test", requirements: [rule], facts: [fact("A", 700), fact("B", 900), fact("C", 800), fact("D")], now: new Date(0) });
    expect(r.findings.map((f) => `${f.id} ${f.element}`)).toEqual(["F-01 A", "F-02 C"]);
    expect(r.notEvaluated).toBe(1);
    expect(describeFinding(r.findings[0])).toBe("700 mm (27.6 in); required at least 812.8 mm (32 in)");
  });
});
