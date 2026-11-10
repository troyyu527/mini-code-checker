// Builds client/public/samples/office/report.json from the sample model and the hand-written rules.
// Run: npm run build:report   (lesson 30 adds --ai: AI agents write the rules)
import { writeFileSync } from "node:fs";
import { buildReport, ReportSchema } from "@shared/report";
import { HAND_RULES } from "./handRules";
import { readModel, SAMPLE_ID } from "./ifc";

const OUT = `client/public/samples/${SAMPLE_ID}/report.json`;

const model = await readModel();
const report = ReportSchema.parse(
  buildReport({
    sampleId: SAMPLE_ID,
    rulesBy: "hand-written rules",
    requirements: HAND_RULES,
    facts: model.facts,
    trace: [{ agent: "checker", summary: `${HAND_RULES.length} rules on ${model.facts.length} elements`, ms: 1 }],
  }),
);
writeFileSync(OUT, JSON.stringify(report, null, 2) + "\n");
console.log(`${OUT}: ${report.findings.length} findings, ${report.notEvaluated} not evaluated`);
for (const f of report.findings) console.log(`  ${f.id} ${f.severity.padEnd(5)} ${f.element} ${f.quantity} ${f.observed} (limit ${f.limit})`);