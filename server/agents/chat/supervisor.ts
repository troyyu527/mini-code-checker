// Supervisor: decides what kind of message this is. Plain code first (element names, finding ids); the LLM only
// when the code cannot tell. Fewer LLM calls = faster, cheaper and more predictable.
import { z } from "zod";
import type { ElementFacts } from "@shared/elementFacts";
import type { LlmClient } from "../../services/llm";
import type { FindingWithRule } from "../../services/modelData";
import { askJson } from "../../services/structured";

export type Decision =
  | { route: "finding"; globalIds: string[]; names: string[] }
  | { route: "question"; query: string }
  | { route: "ask_user"; clarify: string };

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Elements named in the message ("D-104", "room 105") or reached through a finding id ("F-02"). */
export function mentionedElements(message: string, facts: ElementFacts[], findings: FindingWithRule[]): ElementFacts[] {
  const found = new Map<string, ElementFacts>();
  for (const f of facts) {
    // A whole name only: no letter, digit, "-" or "." right before or after it. So room "104" does not match inside
    // door "D-104" (\b would: it treats "-" as a word boundary) and room "101" not inside section "1010.1".
    if (f.name && new RegExp(`(?<![\\w.-])${escape(f.name)}(?![\\w-]|\\.\\d)`, "i").test(message)) found.set(f.globalId, f);
  }
  for (const id of message.match(/\bF-\d{2}\b/gi) ?? []) {
    const hit = findings.find((x) => x.finding.id.toLowerCase() === id.toLowerCase());
    const fact = hit && facts.find((f) => f.globalId === hit.finding.globalId);
    if (fact) found.set(fact.globalId, fact);
  }
  return [...found.values()];
}

const LlmDecision = z.discriminatedUnion("route", [
  z.object({ route: z.literal("question"), query: z.string().min(2).max(200) }),
  z.object({ route: z.literal("ask_user"), clarify: z.string().min(2).max(300) }),
]);

const SYSTEM = `You route messages for a building-code assistant (2022 NYC Building Code, means of egress and interior environment).
If the message asks anything about buildings or building rules, reply {"route": "question", "query": "<the question in the code's own words>"},
even when you think the code may not cover it: the search decides that, not you.
Only if the message contains no question or request at all, reply {"route": "ask_user", "clarify": "<one short question back>"}.
Reply with JSON only.`;

export async function supervise(
  llm: LlmClient,
  input: { message: string; facts: ElementFacts[]; findings: FindingWithRule[] },
): Promise<Decision> {
  const elements = mentionedElements(input.message, input.facts, input.findings);
  // "all issues" / "every finding": the whole report
  const all = /\b(all|every)\b.*\b(issues?|findings?|problems?)\b/i.test(input.message);
  if (elements.length || all) {
    const list = elements.length ? elements : input.facts.filter((f) => input.findings.some((x) => x.finding.globalId === f.globalId));
    return { route: "finding", globalIds: list.map((f) => f.globalId), names: list.map((f) => f.name ?? f.globalId) };
  }
  return askJson(llm, [{ role: "system", content: SYSTEM }, { role: "user", content: input.message }], LlmDecision);
}
