// Writes the sample's element facts and its report (rules + findings) to the local D1. Run: npm run seed
import { readFileSync } from "node:fs";
import { ReportSchema } from "@shared/report";
import { applySchema, saveModelAndReport } from "../services/modelData";
import { readModel, SAMPLE_ID } from "./ifc";
import { openBindings } from "./platform";

const { env, dispose } = await openBindings();
try {
  await applySchema(env.DB, readFileSync("db/schema.sql", "utf8"));
  const model = await readModel();
  const report = ReportSchema.parse(JSON.parse(readFileSync(`client/public/samples/${SAMPLE_ID}/report.json`, "utf8")));
  await saveModelAndReport(env.DB, model.facts, report);
  const { n } = (await env.DB.prepare("SELECT COUNT(*) AS n FROM findings").first<{ n: number }>())!;
  console.log(`${model.facts.length} elements, ${report.requirements.length} rules, ${n} findings in the local D1`);
} finally {
  await dispose();
}
