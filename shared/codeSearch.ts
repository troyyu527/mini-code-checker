// Code search: the hit shape, and pure helpers for keyword queries, rank fusion and short verbatim quotes.
import { z } from "zod";

export interface CodeHit {
  chunkId: string;
  section: string;
  provisions: string[];
  page: number | null;
  sourceUrl: string;
  /** A word-for-word piece of the clause, at most QUOTE_MAX characters. */
  quote: string;
  /** Which searches found it: "keyword", "vector". */
  foundBy: string[];
}

export const CodeSearchQuerySchema = z.object({
  q: z.string().trim().min(2).max(300),
  k: z.coerce.number().int().min(1).max(10).default(5),
});

export const QUOTE_MAX = 400;

const STOPWORDS = new Set(
  "a an and are as at be by can do does for from how in is it must of on or shall the to what when where which with".split(" "),
);

/** Section numbers such as 1010.1.1 in a question. */
const PROVISION = /\b\d{1,4}(?:\.\d+)+\b/g;

/**
 * Builds an FTS5 MATCH expression: every word in double quotes, joined with OR. Quoting each word means a visitor
 * can never type FTS5 syntax (NEAR, *, -, parentheses) into our query.
 * "1010.1.1" becomes the phrase "1010 1 1", because FTS5 splits numbers at the dots.
 */
export function ftsQuery(q: string): string {
  const provisions = q.match(PROVISION) ?? [];
  const rest = q.replace(PROVISION, " ").toLowerCase();
  const words = [...new Set(rest.match(/[a-z0-9]+/g) ?? [])].filter((w) => w.length > 1 && !STOPWORDS.has(w));
  const terms = [...provisions.map((p) => `"${p.split(".").join(" ")}"`), ...words.map((w) => `"${w}"`)];
  return terms.join(" OR ");
}

/** Reciprocal rank fusion: each list gives 1 / (k + rank) to each id; ids found by both lists rise to the top. */
export function fuseRanks(lists: Record<string, string[]>, k = 60): { id: string; score: number; foundBy: string[] }[] {
  const out = new Map<string, { id: string; score: number; foundBy: string[] }>();
  for (const [name, ids] of Object.entries(lists)) {
    ids.forEach((id, i) => {
      const e = out.get(id) ?? { id, score: 0, foundBy: [] };
      e.score += 1 / (k + i + 1);
      e.foundBy.push(name);
      out.set(id, e);
    });
  }
  return [...out.values()].sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}

/** Lower-case query words without stopwords and without a plural "s" (doors → door). */
export function queryTerms(q: string): string[] {
  const words = (q.toLowerCase().match(/[a-z0-9]+(?:\.\d+)*/g) ?? []).filter((w) => w.length > 1 && !STOPWORDS.has(w));
  return [...new Set(words.map((w) => (w.length > 3 && /[^s]s$/.test(w) ? w.slice(0, -1) : w)))];
}

/**
 * The sentence with the most query words, plus the next sentences while they fit in `max` characters.
 * Always a word-for-word piece of `text`, so a citation can be checked.
 */
/** Where each sentence starts and ends. A sentence ends at . ! ? followed by a space or the end of the text, so
 *  "1015.3" and "(812.8 mm)" stay inside one sentence. */
export function sentenceSpans(text: string): { start: number; end: number }[] {
  return [...text.matchAll(/(?:[^.!?]|[.!?](?!\s|$))+(?:[.!?](?=\s|$))?/g)]
    .map((m) => ({ start: m.index, end: m.index + m[0].length }))
    .filter((s) => text.slice(s.start, s.end).trim());
}

export function quoteFor(text: string, q: string, max = QUOTE_MAX): string {
  const terms = queryTerms(q);
  const sentences = sentenceSpans(text);
  if (!sentences.length) return text.slice(0, max).trim();
  const score = (s: { start: number; end: number }) => {
    const t = text.slice(s.start, s.end).toLowerCase();
    return terms.reduce((n, w) => n + (t.includes(w) ? 1 : 0), 0);
  };
  let best = 0;
  sentences.forEach((s, i) => {
    if (score(s) > score(sentences[best])) best = i;
  });
  const start = sentences[best].start;
  let end = sentences[best].end;
  for (let i = best + 1; i < sentences.length && sentences[i].end - start <= max; i++) end = sentences[i].end;
  const raw = text.slice(start, Math.min(end, start + max));
  return (end - start > max ? raw.replace(/\s+\S*$/, "") : raw).trim();
}
