import { describe, expect, it } from "vitest";
import { ftsQuery, quoteFor } from "@shared/codeSearch";

describe("ftsQuery", () => {
  it("quotes every word and turns section numbers into phrases", () => {
    expect(ftsQuery("door width 1010.1.1")).toBe('"1010 1 1" OR "door" OR "width"');
  });
  it("cannot be used to inject FTS5 syntax", () => {
    expect(ftsQuery('door* NEAR(width) -"x"')).toBe('"door" OR "near" OR "width"');
  });
  it("is empty when only stopwords are left", () => {
    expect(ftsQuery("what is the")).toBe("");
  });
});

describe("quoteFor", () => {
  const body = "1010.1.1.2 Projections. No projections. 1010.1.1.3 Door height. The height of doors shall be not less than 80 inches (2032 mm).";
  it("returns a word-for-word piece of the text with the query words", () => {
    const q = quoteFor(body, "door height");
    expect(body.includes(q)).toBe(true);
    expect(q).toContain("80 inches");
  });
  it("does not end a sentence inside \"1010.1.1.3\" or \"(2032 mm)\"", () => {
    expect(quoteFor(body, "2032")).toBe("The height of doors shall be not less than 80 inches (2032 mm).");
  });
});