// Code search over the clauses in D1: rows + an FTS5 keyword index. Lesson 27 adds vectors and fusion.
import { type CodeHit, ftsQuery, quoteFor } from "@shared/codeSearch";

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

/** Writes new or changed clauses (row + keyword index). Unchanged ones are skipped, so a re-run is cheap. */
export async function upsertChunks(db: D1Database, lines: ClauseLine[]): Promise<{ written: number; unchanged: number }> {
  const { results } = await db.prepare("SELECT id, text_hash FROM code_chunks").all<{ id: string; text_hash: string }>();
  const known = new Map(results.map((r) => [r.id, r.text_hash]));
  const hashed = await Promise.all(lines.map(async (c) => ({ c, hash: await sha1(c.text) })));
  const todo = hashed.filter(({ c, hash }) => known.get(c.id) !== hash);

  const row = db.prepare(
    `INSERT OR REPLACE INTO code_chunks (id, section, heading, provisions, page, source_url, body, text_hash)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const ftsDelete = db.prepare("DELETE FROM code_chunks_fts WHERE id = ?");
  const fts = db.prepare("INSERT INTO code_chunks_fts (id, heading, provisions, body) VALUES (?, ?, ?, ?)");

  for (let i = 0; i < todo.length; i += 32) {
    const batch = todo.slice(i, i + 32);
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
  }
  return { written: todo.length, unchanged: lines.length - todo.length };
}

export interface CodeSearch {
  search(q: string, k: number): Promise<CodeHit[]>;
  /** The full clause text, for the agents (the visitor only sees short quotes). */
  body(chunkId: string): Promise<string | null>;
}

export function createCodeSearch(deps: { db: D1Database }): CodeSearch {
  const { db } = deps;

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

  return {
    async search(q, k) {
      const ids = (await keyword(q)).slice(0, k);
      if (!ids.length) return [];
      const { results } = await db
        .prepare(`SELECT id, section, heading, provisions, page, source_url, body FROM code_chunks WHERE id IN (${ids.map(() => "?").join(",")})`)
        .bind(...ids)
        .all<ChunkRow>();
      const byId = new Map(results.map((r) => [r.id, r]));
      return ids.flatMap((id): CodeHit[] => {
        const r = byId.get(id);
        if (!r) return [];
        const provisions = JSON.parse(r.provisions) as string[];
        return [{ chunkId: r.id, section: provisions[0] ?? r.section, provisions, page: r.page, sourceUrl: r.source_url, quote: quoteFor(r.body, q), foundBy: ["keyword"] }];
      });
    },
    async body(chunkId) {
      const r = await db.prepare("SELECT body FROM code_chunks WHERE id = ?").bind(chunkId).first<{ body: string }>();
      return r?.body ?? null;
    },
  };
}