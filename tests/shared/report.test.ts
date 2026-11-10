import { describe, expect, it } from "vitest";
import { describeFinding } from "@shared/report";
import { formatFact } from "@shared/units";

describe("display text", () => {
  it("shows mm with inches", () => {
    expect(formatFact(762, "clearWidthMm")).toBe("762 mm (30 in)");
  });
  it("describes a finding", () => {
    expect(describeFinding({ observed: 711, limit: 812.8, op: ">=", quantity: "clearWidthMm" })).toBe(
      "711 mm (28 in); required at least 812.8 mm (32 in)",
    );
  });
});