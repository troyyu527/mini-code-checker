import { describe, expect, it } from "vitest";
import type { CodeHit } from "@shared/codeSearch";
import { researchCode } from "../../server/agents/chat/research";
import { type EvidenceItem, markCitations, publicEvidence, writeAnswer } from "../../server/agents/chat/writer";
import type { CodeSearch } from "../../server/services/codeSearch";
import { scriptedLlm } from "../fakes/llm";

const hit = (id: string, section: string): CodeHit => ({ chunkId: id, section, provisions: [section], page: 21, sourceUrl: "https://example.org", quote: "short quote", foundBy: ["keyword"] });
const fakeSearch: CodeSearch = {
  search: async () => [hit("A", "1010.1.1.1"), hit("GONE", "9.9")],
  body: async (id) => (id === "A" ? "Doors shall provide a minimum clear width of 32 inches." : null),
};
const code: EvidenceItem = { id: "E1", kind: "code", chunkId: "A", section: "1010.1.1.1", page: 21, sourceUrl: "https://example.org", quote: "32 inches", text: "Doors shall provide a minimum clear width of 32 inches." };

describe("researchCode", () => {
  it("numbers the passages E1, E2 … and skips a clause whose text is gone", async () => {
    const ev = await researchCode(fakeSearch, "door width");
    expect(ev.map((e) => e.id)).toEqual(["E1"]);
    expect(ev[0]).toMatchObject({ kind: "code", section: "1010.1.1.1", text: "Doors shall provide a minimum clear width of 32 inches." });
  });
});

describe("writeAnswer", () => {
  it("returns a cited answer", async () => {
    const r = await writeAnswer(scriptedLlm(['{"answer": "At least 32 in [E1].", "cites": ["E1"], "enough": true}']), { message: "door?", evidence: [code], needsCode: true });
    expect(r).toEqual({ answer: "At least 32 in [E1].", cites: ["E1"], enough: true });
  });
  it("drops cites that do not exist, then asks again when nothing real is cited", async () => {
    const llm = scriptedLlm(['{"answer": "32 in [E9].", "cites": ["E9"], "enough": true}', '{"answer": "32 in [E1].", "cites": ["E1"], "enough": true}']);
    expect((await writeAnswer(llm, { message: "door?", evidence: [code], needsCode: true })).cites).toEqual(["E1"]);
    expect(llm.calls[1].at(-1)!.content).toMatch(/cite at least one evidence id/);
  });
  it("lets the model say the passages are not enough", async () => {
    const r = await writeAnswer(scriptedLlm(['{"answer": "-", "cites": [], "enough": false}']), { message: "pool?", evidence: [code], needsCode: true });
    expect(r.enough).toBe(false);
  });
  it("puts the clause text in the prompt, numbered", async () => {
    const llm = scriptedLlm(['{"answer": "32 in [E1].", "cites": ["E1"], "enough": true}']);
    await writeAnswer(llm, { message: "door?", evidence: [code], needsCode: true });
    expect(llm.calls[0][1].content).toContain("[E1] NYC BC §1010.1.1.1, p. 21:\nDoors shall provide");
  });
});

describe("citations", () => {
  it("adds the markers when the model forgot them", () => {
    expect(markCitations("At least 32 in.", ["E1", "E2"])).toBe("At least 32 in. [E1][E2]");
    expect(markCitations("At least 32 in [E1].", ["E1"])).toBe("At least 32 in [E1].");
  });
  it("never sends the full clause text to the browser", () => {
    expect(publicEvidence([code])[0]).not.toHaveProperty("text");
  });
});