import { describe, expect, it } from "vitest";
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