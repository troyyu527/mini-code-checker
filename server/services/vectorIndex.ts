// Vector search over the clauses: one interface and a local D1 table. Lesson 39 adds Cloudflare Vectorize.

export interface VectorIndex {
  upsert(items: { id: string; vector: number[] }[]): Promise<void>;
  /** Cosine similarity, best first. */
  query(vector: number[], topK: number): Promise<{ id: string; score: number }[]>;
  count(): Promise<number>;
}

/** Scales a vector to length 1; then cosine similarity is just the dot product. */
export function normalise(v: number[]): number[] {
  const len = Math.hypot(...v) || 1;
  return v.map((x) => x / len);
}

export function dot(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

/**
 * Local: vectors as JSON text in D1, searched by comparing the question with every row (258 clauses × 384 numbers
 * is small). Vectorize has no local mode, so `wrangler dev` uses this instead.
 */
export function createD1VectorIndex(db: D1Database): VectorIndex {
  let cache: { n: number; rows: { id: string; vector: number[] }[] } | null = null;
  const count = async () => (await db.prepare("SELECT COUNT(*) AS n FROM code_vectors").first<{ n: number }>())?.n ?? 0;
  return {
    count,
    async upsert(items) {
      const stmt = db.prepare("INSERT OR REPLACE INTO code_vectors (id, vector) VALUES (?, ?)");
      await db.batch(items.map((it) => stmt.bind(it.id, JSON.stringify(normalise(it.vector)))));
      cache = null;
    },
    async query(vector, topK) {
      const n = await count();
      if (!cache || cache.n !== n) {
        const { results } = await db.prepare("SELECT id, vector FROM code_vectors").all<{ id: string; vector: string }>();
        cache = { n, rows: results.map((r) => ({ id: r.id, vector: JSON.parse(r.vector) as number[] })) };
      }
      const q = normalise(vector);
      return cache.rows
        .map((r) => ({ id: r.id, score: dot(q, r.vector) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, topK);
    },
  };
}
