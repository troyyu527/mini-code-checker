// The QA graph with a scripted Rule Author: researcher → rule author → reviewer (→ back on rejection) → checker.
import { describe, expect, it } from "vitest";
import type { CodeHit } from "@shared/codeSearch";
import type { ElementFacts } from "@shared/elementFacts";
import { buildQaGraph, MAX_ATTEMPTS, runQa } from "../../server/agents/qa/graph";
import { TOPICS } from "../../server/agents/qa/topics";
import type { CodeSearch } from "../../server/services/codeSearch";
import { scriptedLlm } from "../fakes/llm";

const BODY = "1010.1.1.1 Door width. The required capacity of each door opening shall provide a minimum clear width of 32 inches (812.2 mm).";
const hit: CodeHit = { chunkId: "S022#051", section: "1010.1.1.1", provisions: ["1010.1.1.1"], page: 21, sourceUrl: "https://example.org", quote: "32 inches", foundBy: ["keyword"] };
const search: CodeSearch = { search: async () => [hit], body: async () => BODY };
const door = (name: string, w: number): ElementFacts => ({ globalId: name.padEnd(22, "x"), expressId: 1, ifcType: "IfcDoor", name, longName: null, objectType: null, storey: "L1", dims: { clearWidthMm: w } });
const facts = [door("D-1", 762), door("D-2", 914)];
const topics = [TOPICS.find((t) => t.id === "door_clear_width")!];
const GOOD = '{"rule": {"title": "Door width", "op": ">=", "value": 32, "unit": "in", "chunkId": "S022#051", "quote": "shall provide a minimum clear width of 32 inches (812.2 mm)"}}';
const INVENTED = '{"rule": {"title": "Door width", "op": ">=", "value": 32, "unit": "in", "chunkId": "S022#051", "quote": "Doors must be 32 inches wide."}}';

describe("QA graph", () => {
  it("writes a rule, accepts it, and checks the model with it", async () => {
    const graph = buildQaGraph({ llm: scriptedLlm([GOOD]), search, model: "test", sampleId: "t" });
    const report = await runQa(graph, topics, facts);
    expect(report.requirements[0]).toMatchObject({ id: "R-01", limit: 812.8, citation: { section: "1010.1.1.1" } });
    expect(report.findings.map((f) => f.element)).toEqual(["D-1"]);
    expect(report.trace.map((t) => t.agent)).toEqual(["researcher", "rule_author", "reviewer", "checker"]);
  });

  it("sends a rejected rule back to the Rule Author with the reviewer's feedback", async () => {
    const llm = scriptedLlm([INVENTED, GOOD]);
    const report = await runQa(buildQaGraph({ llm, search, model: "test", sampleId: "t" }), topics, facts);
    expect(report.requirements).toHaveLength(1);
    expect(llm.calls[1].at(-1)!.content).toMatch(/A reviewer rejected your previous rule/);
  });

  it(`gives up after ${MAX_ATTEMPTS} attempts and reports no rule`, async () => {
    const llm = scriptedLlm([INVENTED, INVENTED, INVENTED]);
    const report = await runQa(buildQaGraph({ llm, search, model: "test", sampleId: "t" }), topics, facts);
    expect(report.requirements).toEqual([]);
    expect(report.trace.at(-2)!.summary).toMatch(/give up/);
  });
});
