import { describe, expect, it } from "vitest";
import { inchesToMm } from "@shared/units";

describe("inchesToMm", () => {
  it("converts the 32 in door width to 812.8 mm", () => {
    expect(inchesToMm(32)).toBeCloseTo(812.8);
  });
  it("keeps 0 as 0", () => {
    expect(inchesToMm(0)).toBe(0);
  });
});