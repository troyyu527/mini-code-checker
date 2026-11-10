// Builds client/public/samples/office/report.json.
//   npm run build:report            hand-written rules (no AI)
//   npm run build:report -- --ai    AI agents write the rules from the code text (needs Ollama and `npm run ingest`)
import { writeFileSync } from "node:fs";
import { buildReport, type Report, ReportSchema } from "@shared/report";
import { buildQaGraph, runQa } from "../agents/qa/graph";
import { planTopics } from "../agents/qa/topics";
import { aiPlatform } from "../services/aiPlatform";
import { createCodeSearch } from "../services/codeSearch";
import { meteredLlm } from "../services/llm";
import { HAND_RULES } from "./handRules";
import { readModel, SAMPLE_ID } from "./ifc";
import { openBindings } from "./platform";

const OUT = `client/public/samples/${SAMPLE_ID}/report.json`;
const model = await readModel();

async function aiReport(): Promise<Report> {
  const { env, dispose } = await openBindings();
  try {
    const ai = aiPlatform(env);
    const llm = meteredLlm(ai.llm);
    const graph = buildQaGraph({ llm, search: createCodeSearch({ db: env.DB, index: ai.index, embedder: ai.embedder }), model: ai.model, sampleId: SAMPLE_ID });
    const t = Date.now();
    const report = await runQa(graph, planTopics(model.facts), model.facts, (e) => console.log(`  ${e.agent.padEnd(11)} ${e.summary}`));
    const u = llm.usage();
    console.log(`${u.llmCalls} LLM calls, ${u.inputTokens} input + ${u.outputTokens} output tokens, ${Math.round((Date.now() - t) / 1000)} s`);
    return report;
  } finally {
    await dispose();
  }
}

const report = ReportSchema.parse(
  process.argv.includes("--ai")
    ? await aiReport()
    : buildReport({
        sampleId: SAMPLE_ID,
        rulesBy: "hand-written rules",
        requirements: HAND_RULES,
        facts: model.facts,
        trace: [{ agent: "checker", summary: `${HAND_RULES.length} rules on ${model.facts.length} elements`, ms: 1 }],
      }),
);
writeFileSync(OUT, JSON.stringify(report, null, 2) + "\n");
console.log(`${OUT}: ${report.requirements.length} rules, ${report.findings.length} findings, ${report.notEvaluated} not evaluated`);
for (const r of report.requirements) console.log(`  ${r.id} ${r.appliesTo} ${r.quantity} ${r.op} ${r.limit} (${r.value} ${r.unit}, §${r.citation.section})`);
for (const f of report.findings) console.log(`  ${f.id} ${f.severity.padEnd(5)} ${f.element} ${f.quantity} ${f.observed} (limit ${f.limit})`);
