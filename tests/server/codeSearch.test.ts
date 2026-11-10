import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { fuseRanks } from "@shared/codeSearch";
import { type ClauseLine, createCodeSearch, upsertChunks } from "../../server/services/codeSearch";
import type { Embedder } from "../../server/services/llm";
import { applySchema } from "../../server/services/modelData";
import { createD1VectorIndex, normalise } from "../../server/services/vectorIndex";
import { memoryD1 } from "../fakes/d1";

const clause = (id: string, provision: string, text: string): ClauseLine => ({
  id, section: provision, text: `NYC BC · §${provision}\n\n${text}`, metadata: { provisions: [provision], page_start: 1, source_url: "https://example.org" },
});
const CLAUSES = [
  clause("A", "1010.1.1.1", "1010.1.1.1 Door width. Doors shall provide a minimum clear width of 32 inches (812.8 mm)."),
  clause("B", "1208.2", "1208.2 Minimum ceiling heights. Occupiable spaces shall have a ceiling height of not less than 7 feet 6 inches."),
  clause("C", "1011.5.2", "1011.5.2 Riser height and tread depth. Stair riser heights shall be 7 inches maximum."),
];

/**
 * A pretend embedding model with three "meanings": doors, ceilings, stairs. A text gets 1 on every meaning it has a
 * word for. Real models learn thousands of such directions; this one is just enough to test the search.
 */
const MEANINGS: [string, RegExp][] = [
  ["doors", /\b(door|doors|opening|width)\b/i],
  ["ceilings", /\b(ceiling|ceilings|headroom|low)\b/i],
  ["stairs", /\b(stair|stairs|riser|tread|steep)\b/i],
];
const fakeEmbedder: Embedder & { calls: number } = {
  calls: 0,
  async embed(texts) {
    this.calls++;
    return texts.map((t) => MEANINGS.map(([, re]) => (re.test(t) ? 1 : 0)));
  },
};

describe("code search (keywords + vectors)", () => {
  const db = memoryD1();
  const index = createD1VectorIndex(db);
  const search = () => createCodeSearch({ db, index, embedder: fakeEmbedder });
  beforeAll(async () => {
    await applySchema(db, readFileSync("db/schema.sql", "utf8"));
    await upsertChunks(db, index, fakeEmbedder, CLAUSES);
  });

  it("finds the clause by its words, with both searches agreeing", async () => {
    const [hit] = await search().search("minimum door width", 3);
    expect(hit).toMatchObject({ chunkId: "A", section: "1010.1.1.1", foundBy: ["vector", "keyword"] });
    expect(hit.quote).toContain("32 inches");
  });
  it("finds a clause by meaning when no word matches: 'steep' → the riser rule", async () => {
    // keywords: FTS5 does not stem, so "stairs" does not match "Stair", and no clause says "steep"
    expect(await search().search("stairs too steep", 3, "keyword")).toEqual([]);
    const [hit] = await search().search("stairs too steep", 3, "vector");
    expect(hit).toMatchObject({ chunkId: "C", foundBy: ["vector"] });
  });
  it("a second ingest of the same text embeds nothing", async () => {
    const before = fakeEmbedder.calls;
    expect(await upsertChunks(db, index, fakeEmbedder, CLAUSES)).toEqual({ written: 0, unchanged: 3 });
    expect(fakeEmbedder.calls).toBe(before);
  });
  it("odd input is not an error", async () => {
    await expect(search().search('"*** NEAR(', 3)).resolves.toBeInstanceOf(Array);
  });
});

describe("vectors and fusion", () => {
  it("normalise makes length 1, so the dot product is the cosine", () => {
    expect(normalise([3, 4])).toEqual([0.6, 0.8]);
  });
  it("puts ids found by both lists first", () => {
    const fused = fuseRanks({ vector: ["a", "b"], keyword: ["c", "b"] });
    expect(fused[0]).toMatchObject({ id: "b", foundBy: ["vector", "keyword"] });
    expect(fused.map((f) => f.id)).toEqual(["b", "a", "c"]);
  });
});
