// Researcher: searches the code and turns the best clauses into numbered evidence the Writer may cite.
import type { CodeSearch } from "../../services/codeSearch";
import type { EvidenceItem } from "./writer";

/** How many clauses the answer reads, and how much of each (the LLM's prompt must stay small). */
export const PASSAGES = 4;
export const PASSAGE_CHARS = 1800;

export async function researchCode(search: CodeSearch, query: string): Promise<EvidenceItem[]> {
  const hits = (await search.search(query, PASSAGES)).slice(0, PASSAGES);
  const bodies = await Promise.all(hits.map((h) => search.body(h.chunkId)));
  return hits.flatMap((h, i): EvidenceItem[] => {
    const body = bodies[i];
    if (!body) return [];
    return [{ id: `E${i + 1}`, kind: "code", chunkId: h.chunkId, section: h.section, page: h.page, sourceUrl: h.sourceUrl, quote: h.quote, text: body.slice(0, PASSAGE_CHARS) }];
  });
}
