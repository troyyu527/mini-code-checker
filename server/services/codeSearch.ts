// Code RAG: stores the clauses in D1 (rows + FTS5 + vectors) and searches them by keywords and by meaning.
import { type CodeHit, ftsQuery, fuseRanks, quoteFor } from "@shared/codeSearch";
import type { Embedder } from "./llm";
import type { VectorIndex } from "./vectorIndex";

/** One line of clauses.jsonl (the fields used here). */
export interface ClauseLine {
  id: string;
  section: string;
  text: string;
  metadata: { provisions: string[]; page_start: number | null; source_url: string };
}

interface ChunkRow {
  id: string;
  section: string;
  heading: string;
  provisions: string;
  page: number | null;
  source_url: string;
  body: string;
}

/** bge models want this instruction before a search question (not before the stored clauses). */
export const QUERY_PREFIX = "Represent this sentence for searching relevant passages: ";
const POOL = 20;

/** The clause text starts with a context line, then an empty line, then the clause. */
export function splitChunkText(text: string): { heading: string; body: string } {
  const i = text.indexOf("\n\n");
  return i < 0 ? { heading: "", body: text } : { heading: text.slice(0, i), body: text.slice(i + 2) };
}

export async function sha1(text: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(text));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Writes new or changed clauses (row, keyword index, vector). Unchanged ones are skipped, so a re-run is cheap. */
export async function upsertChunks(
  db: D1Database,
  index: VectorIndex,
  embedder: Embedder,
  lines: ClauseLine[],
  onBatch: (done: number) => void = () => {},
): Promise<{ written: number; unchanged: number }> {
  const { results } = await db.prepare("SELECT id, text_hash FROM code_chunks").all<{ id: string; text_hash: string }>();
  const known = new Map(results.map((r) => [r.id, r.text_hash]));
  const missingVectors = (await index.count()) < known.size;
  const hashed = await Promise.all(lines.map(async (c) => ({ c, hash: await sha1(c.text) })));
  const todo = hashed.filter(({ c, hash }) => missingVectors || known.get(c.id) !== hash);

  const row = db.prepare(
    `INSERT OR REPLACE INTO code_chunks (id, section, heading, provisions, page, source_url, body, text_hash)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const ftsDelete = db.prepare("DELETE FROM code_chunks_fts WHERE id = ?");
  const fts = db.prepare("INSERT INTO code_chunks_fts (id, heading, provisions, body) VALUES (?, ?, ?, ?)");

  for (let i = 0; i < todo.length; i += 32) {
    const batch = todo.slice(i, i + 32);
    const vectors = await embedder.embed(batch.map(({ c }) => c.text));
    await db.batch(
      batch.flatMap(({ c, hash }) => {
        const { heading, body } = splitChunkText(c.text);
        const m = c.metadata;
        return [
          row.bind(c.id, c.section, heading, JSON.stringify(m.provisions), m.page_start, m.source_url, body, hash),
          ftsDelete.bind(c.id),
          fts.bind(c.id, heading, m.provisions.join(" "), body),
        ];
      }),
    );
    await index.upsert(batch.map(({ c }, j) => ({ id: c.id, vector: vectors[j] })));
    onBatch(i + batch.length);
  }
  return { written: todo.length, unchanged: lines.length - todo.length };
}

export type SearchMode = "hybrid" | "keyword" | "vector";

export interface CodeSearch {
  search(q: string, k: number, mode?: SearchMode): Promise<CodeHit[]>;
  /** The full clause text, for the agents (the visitor only sees short quotes). */
  body(chunkId: string): Promise<string | null>;
}

export function createCodeSearch(deps: { db: D1Database; index: VectorIndex; embedder: Embedder }): CodeSearch {
  const { db, index, embedder } = deps;

  async function keyword(q: string): Promise<string[]> {
    const match = ftsQuery(q);
    if (!match) return [];
    // bm25 weights per column (id, heading, provisions, body): a word in the section number counts most
    const { results } = await db
      .prepare("SELECT id FROM code_chunks_fts WHERE code_chunks_fts MATCH ? ORDER BY bm25(code_chunks_fts, 0, 2.0, 4.0, 1.0) LIMIT ?")
      .bind(match, POOL)
      .all<{ id: string }>();
    return results.map((r) => r.id);
  }

  async function vector(q: string): Promise<string[]> {
    const [v] = await embedder.embed([QUERY_PREFIX + q]);
    return (await index.query(v, POOL)).map((r) => r.id);
  }

  return {
    async search(q, k, mode = "hybrid") {
      const [vec, kw] = await Promise.all([mode === "keyword" ? [] : vector(q), mode === "vector" ? [] : keyword(q)]);
      const fused = fuseRanks({ vector: vec, keyword: kw }).slice(0, k);
      if (!fused.length) return [];
      const { results } = await db
        .prepare(`SELECT id, section, heading, provisions, page, source_url, body FROM code_chunks WHERE id IN (${fused.map(() => "?").join(",")})`)
        .bind(...fused.map((f) => f.id))
        .all<ChunkRow>();
      const byId = new Map(results.map((r) => [r.id, r]));
      return fused.flatMap((f): CodeHit[] => {
        const r = byId.get(f.id);
        if (!r) return [];
        const provisions = JSON.parse(r.provisions) as string[];
        return [{ chunkId: r.id, section: provisions[0] ?? r.section, provisions, page: r.page, sourceUrl: r.source_url, quote: quoteFor(r.body, q), foundBy: f.foundBy }];
      });
    },
    async body(chunkId) {
      const r = await db.prepare("SELECT body FROM code_chunks WHERE id = ?").bind(chunkId).first<{ body: string }>();
      return r?.body ?? null;
    },
  };
}
