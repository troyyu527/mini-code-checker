import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it } from "vitest";
import { applySchema, getFacts, getFindings, saveModelAndReport } from "../../server/services/modelData";
import { memoryD1 } from "../fakes/d1";
import { FAKE_REPORT } from "../fakes/report";

const facts = FAKE_REPORT.findings.map((f, i) => ({
  globalId: f.globalId, expressId: i, ifcType: f.ifcType, name: f.element, longName: null, objectType: null, storey: f.storey, dims: {},
}));

describe("modelData (D1)", () => {
  let db: D1Database;
  beforeEach(async () => {
    db = memoryD1();
    await applySchema(db, readFileSync("db/schema.sql", "utf8"));
    await saveModelAndReport(db, facts, FAKE_REPORT);
  });

  it("stores the facts and reads them back", async () => {
    expect((await getFacts(db)).map((f) => f.name).sort()).toEqual(["105", "D-104", "D-107"]);
  });
  it("finds the findings of one element, each with the rule it failed", async () => {
    const [x] = await getFindings(db, ["3TakfvuqXJzADJAiopzYwD"]);
    expect(x.finding.element).toBe("D-104");
    expect(x.requirement?.citation.section).toBe("1010.1.1.1");
  });
  it("saving again replaces the rows instead of adding to them", async () => {
    await saveModelAndReport(db, facts, FAKE_REPORT);
    expect(await getFindings(db)).toHaveLength(3);
  });
  it("the schema can be applied twice (IF NOT EXISTS)", async () => {
    await expect(applySchema(db, readFileSync("db/schema.sql", "utf8"))).resolves.toBeUndefined();
  });
});