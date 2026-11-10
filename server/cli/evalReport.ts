// Scores the QA report against the defects that were put into the sample model on purpose. Run: npm run eval:report
import { readFileSync } from "node:fs";
import { scoreDetection } from "@shared/evaluate";
import { ReportSchema } from "@shared/report";

const report = ReportSchema.parse(JSON.parse(readFileSync("client/public/samples/office/report.json", "utf8")));
const defects = JSON.parse(readFileSync("tests/golden/office-defects.json", "utf8")) as { topic: string; element: string; globalId: string }[];

const name = new Map([...report.findings.map((f) => [f.globalId, f.element] as const), ...defects.map((d) => [d.globalId, d.element] as const)]);
const s = scoreDetection(
  report.findings.map((f) => f.globalId),
  defects.map((d) => d.globalId),
);
const names = (ids: string[]) => ids.map((id) => name.get(id) ?? id).join(", ") || "none";

console.log(`rules by: ${report.rulesBy}`);
console.log(`rules: ${report.requirements.map((r) => `${r.quantity} ${r.op} ${r.limit} (§${r.citation.section})`).join(" | ")}`);
console.log(`precision ${(s.precision * 100).toFixed(0)}%  recall ${(s.recall * 100).toFixed(0)}%`);
console.log(`found and real: ${names(s.truePositives)}`);
console.log(`found, not real: ${names(s.falsePositives)}`);
console.log(`real, not found: ${names(s.falseNegatives)}`);
