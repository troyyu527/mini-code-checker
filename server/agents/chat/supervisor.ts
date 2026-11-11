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
  // A room's long name ("the corridor", "the pantry"), but only a name that one element has ("office" names five
  // rooms), and not when the message is about the code text ("the minimum corridor width in the code")
  const aboutCode = /\b(code|section|table|chapter)\b|§/i.test(message);
  const longNames = new Map<string, ElementFacts[]>();
  for (const f of facts) if (f.longName) longNames.set(f.longName.toLowerCase(), [...(longNames.get(f.longName.toLowerCase()) ?? []), f]);
  for (const [longName, owners] of aboutCode ? [] : longNames) {
    if (owners.length === 1 && new RegExp(`\\b${escape(longName)}\\b`, "i").test(message)) found.set(owners[0].globalId, owners[0]);
  }
  for (const id of message.match(/\bF-\d{2}\b/gi) ?? []) {
    const hit = findings.find((x) => x.finding.id.toLowerCase() === id.toLowerCase());
    const fact = hit && facts.find((f) => f.globalId === hit.finding.globalId);
    if (fact) found.set(fact.globalId, fact);
  }
  return [...found.values()];
}

/**
 * A question about the report as a whole: it names the report's own words ("findings", "issues", "problems") or the
 * model itself ("the model", "this building"). The LLM cannot route these: its only choices are a code question or
 * asking back (lesson 41: both models asked back).
 */
export function asksAboutReport(message: string): boolean {
  return (
    /\b(findings?|issues?|problems?|defects?|violations?|failures?|fails?|fix)\b/i.test(message) ||
    /\b(the|this|my|our) (model|building|report)\b/i.test(message) ||
    // the model's elements by kind: "the doors", "which room"
    /\b(the|which|what|any) (doors?|rooms?|spaces?)\b/i.test(message)
  );
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
  const all = asksAboutReport(input.message);
  if (elements.length || all) {
    const list = elements.length ? elements : input.facts.filter((f) => input.findings.some((x) => x.finding.globalId === f.globalId));
    return { route: "finding", globalIds: list.map((f) => f.globalId), names: list.map((f) => f.name ?? f.globalId) };
  }
  return askJson(llm, [{ role: "system", content: SYSTEM }, { role: "user", content: input.message }], LlmDecision);
}
