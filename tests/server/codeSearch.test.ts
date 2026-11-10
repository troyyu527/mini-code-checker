import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { type ClauseLine, createCodeSearch, upsertChunks } from "../../server/services/codeSearch";
import { applySchema } from "../../server/services/modelData";
import { memoryD1 } from "../fakes/d1";

const clause = (id: string, provision: string, text: string): ClauseLine => ({
  id, section: provision, text: `NYC BC · §${provision}\n\n${text}`, metadata: { provisions: [provision], page_start: 1, source_url: "https://example.org" },
});
const CLAUSES = [
  clause("A", "1010.1.1.1", "1010.1.1.1 Door width. Doors shall provide a minimum clear width of 32 inches (812.8 mm)."),
  clause("B", "1208.2", "1208.2 Minimum ceiling heights. Occupiable spaces shall have a ceiling height of not less than 7 feet 6 inches."),
  clause("C", "1011.5.2", "1011.5.2 Riser height and tread depth. Stair riser heights shall be 7 inches maximum."),
];

describe("code search (keywords)", () => {
  const db = memoryD1();
  beforeAll(async () => {
    await applySchema(db, readFileSync("db/schema.sql", "utf8"));
    await upsertChunks(db, CLAUSES);
  });

  it("finds the clause by its words", async () => {
    const [hit] = await createCodeSearch({ db }).search("minimum door width", 3);
    expect(hit).toMatchObject({ chunkId: "A", section: "1010.1.1.1", foundBy: ["keyword"] });
    expect(hit.quote).toContain("32 inches");
  });
  it("finds the clause by its section number", async () => {
    expect((await createCodeSearch({ db }).search("1208.2", 3))[0].chunkId).toBe("B");
  });
  it("a second ingest of the same text writes nothing", async () => {
    expect(await upsertChunks(db, CLAUSES)).toEqual({ written: 0, unchanged: 3 });
  });
  it("odd input is not an error, just no hits", async () => {
    expect(await createCodeSearch({ db }).search('"*** NEAR(', 3)).toEqual([]);
  });
  it("gives the full clause text for the agents", async () => {
    expect(await createCodeSearch({ db }).body("C")).toMatch(/^1011\.5\.2 Riser/);
  });
});