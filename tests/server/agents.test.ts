// The agents with a scripted LLM and fake data: no Ollama, no D1, same result every run.
import { describe, expect, it } from "vitest";
import type { CodeHit } from "@shared/codeSearch";
import type { ElementFacts } from "@shared/elementFacts";
import { makeRequirement } from "@shared/requirement";
import { buildChatGraph, runChat } from "../../server/agents/chat/graph";
import { mentionedElements } from "../../server/agents/chat/supervisor";
import { DONT_KNOW } from "../../server/agents/chat/writer";
import type { CodeSearch } from "../../server/services/codeSearch";
import type { FindingWithRule } from "../../server/services/modelData";
import { scriptedLlm } from "../fakes/llm";

const gid = (s: string) => s.padEnd(22, "x");
const fact = (name: string, ifcType = "IfcDoor"): ElementFacts => ({ globalId: gid(name), expressId: 1, ifcType, name, longName: null, objectType: null, storey: "L1", dims: {} });
const facts = [fact("D-104"), fact("104", "IfcSpace"), fact("101", "IfcSpace")];
const rule = makeRequirement({ id: "R-01", title: "Door width", appliesTo: "IfcDoor", where: [], quantity: "clearWidthMm", op: ">=", value: 32, unit: "in",
  citation: { chunkId: "S022#051", section: "1010.1.1.1", page: 21, sourceUrl: "https://example.org", quote: "a minimum clear width of 32 inches" } });
const findings: FindingWithRule[] = [{
  finding: { id: "F-01", requirementId: "R-01", globalId: gid("D-104"), element: "D-104", ifcType: "IfcDoor", storey: "L1", quantity: "clearWidthMm", observed: 762, limit: 812.8, op: ">=", severity: "minor" },
  requirement: rule,
}];

describe("mentionedElements", () => {
  it("D-104 does not also match room 104", () => {
    expect(mentionedElements("Why does D-104 fail?", facts, findings).map((f) => f.name)).toEqual(["D-104"]);
  });
  it("room 101 does not match inside section 1010.1", () => {
    expect(mentionedElements("What does 1010.1 say?", facts, findings)).toEqual([]);
  });
  it("a finding id leads to its element", () => {
    expect(mentionedElements("explain f-01", facts, findings).map((f) => f.name)).toEqual(["D-104"]);
  });
});

function fakeSearch(hits: CodeHit[], body = "The required capacity … shall provide a minimum clear width of 32 inches (812.2 mm)."): CodeSearch {
  return { search: async () => hits, body: async () => body };
}
const hit: CodeHit = { chunkId: "S022#051", section: "1010.1.1.1", provisions: ["1010.1.1.1"], page: 21, sourceUrl: "https://example.org", quote: "32 inches", foundBy: ["keyword"] };

describe("chat graph", () => {
  it("a finding question needs no supervisor LLM call, cites the finding and highlights the door", async () => {
    const llm = scriptedLlm(['{"answer": "D-104 is 762 mm wide, less than 812.8 mm [E1][E2].", "cites": ["E1", "E2"], "enough": true}']);
    const graph = buildChatGraph({ llm, search: fakeSearch([]), facts: async () => facts, findings: async (ids) => findings.filter((f) => !ids || ids.includes(f.finding.globalId)) });
    const steps: string[] = [];
    const s = await runChat(graph, "run-1", "Why does D-104 fail?", (t) => steps.push(t.agent));
    expect(steps).toEqual(["supervisor", "findings", "writer"]);
    expect(llm.calls).toHaveLength(1); // only the writer
    expect(s.evidence.map((e) => e.kind)).toEqual(["finding", "code"]);
    expect(s.viewerCommands.map((c) => c.action)).toEqual(["highlight", "zoom"]);
  });

  it("says I don't know when the passages do not answer", async () => {
    const llm = scriptedLlm(['{"route": "question", "query": "pool depth"}', '{"answer": "-", "cites": [], "enough": false}']);
    const graph = buildChatGraph({ llm, search: fakeSearch([hit]), facts: async () => facts, findings: async () => [] });
    const s = await runChat(graph, "run-2", "How deep must a pool be?");
    expect(s.answer).toBe(DONT_KNOW);
    expect(s.evidence).toEqual([]);
  });

  it("a code answer that cites no code passage is sent back once (zod refine), then accepted", async () => {
    const llm = scriptedLlm([
      '{"route": "question", "query": "door width"}',
      '{"answer": "32 in.", "cites": [], "enough": true}',
      '{"answer": "32 in [E1].", "cites": ["E1"], "enough": true}',
    ]);
    const graph = buildChatGraph({ llm, search: fakeSearch([hit]), facts: async () => facts, findings: async () => [] });
    const s = await runChat(graph, "run-3", "How wide must a door be?");
    expect(s.answer).toBe("32 in [E1].");
    expect(llm.calls).toHaveLength(3);
  });
});
