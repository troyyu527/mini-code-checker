// Reviewer: checks an AI-written rule with plain code. An LLM can misquote or misread; these checks cannot be talked
// out of their answer. Every problem becomes feedback for the Rule Author's next attempt.
import { QUOTE_MAX, sentenceSpans } from "@shared/codeSearch";
import { toFactUnit } from "@shared/units";
import type { AuthoredRule, Passage } from "./ruleAuthor";
import type { Topic } from "./topics";

const squash = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();
const words = (s: string) => new Set(s.toLowerCase().match(/[a-z0-9]+(?:\.\d+)?/g) ?? []);

/**
 * LLMs copy text imperfectly ("Occiupable" for "Occupiable"), and asking again often repeats the same slip.
 * If at least 3/4 of the quote's words are in one sentence of the passage, that exact sentence is the quote.
 */
export function repairQuote(quote: string, body: string): string | null {
  const q = words(quote);
  if (!q.size) return null;
  let best: { text: string; share: number } | null = null;
  for (const s of sentenceSpans(body)) {
    const text = body.slice(s.start, s.end).trim();
    const w = words(text);
    const share = [...q].filter((x) => w.has(x)).length / q.size;
    if (!best || share > best.share) best = { text, share };
  }
  return best && best.share >= 0.75 && best.text.length <= QUOTE_MAX ? best.text : null;
}

export interface Review {
  problems: string[];
  /** The quote to keep: the rule's own, or the exact passage sentence it was repaired to. */
  quote: string;
  repaired: boolean;
}

export function reviewRule(rule: AuthoredRule, topic: Topic, passages: Passage[]): Review {
  const problems: string[] = [];
  let quote = rule.quote.trim();
  let repaired = false;
  const passage = passages.find((p) => p.chunkId === rule.chunkId);
  // 1. The quote must be word for word in the passage it names (spaces and case aside) — or repairable to it.
  if (!passage) problems.push(`passage ${rule.chunkId} was not given to you`);
  else if (!squash(passage.body).includes(squash(quote))) {
    const fixed = repairQuote(quote, passage.body);
    if (fixed) {
      quote = fixed;
      repaired = true;
    } else problems.push(`the quote is not word for word in passage ${rule.chunkId}; copy the exact sentence`);
  }
  // 2. The quote must contain the limit: the value as written, or its metric value.
  const limit = toFactUnit(rule.value, rule.unit, topic.quantity);
  const numbers = (quote.match(/\d+(?:\.\d+)?/g) ?? []).map(Number);
  const hasValue = numbers.includes(rule.value) || (limit !== null && numbers.some((n) => Math.abs(n - limit) <= 1));
  if (!hasValue) problems.push(`the quote does not contain the value ${rule.value} ${rule.unit}`);
  // 3. The converted limit must be plausible for this quantity.
  if (limit !== null && (limit < topic.range[0] || limit > topic.range[1])) {
    problems.push(`${rule.value} ${rule.unit} = ${Math.round(limit)} mm is not a plausible ${topic.title.toLowerCase()} limit`);
  }
  return { problems, quote, repaired };
}
