// Answers one building-code question from the clauses in the local D1, with citations. Run: npm run ask -- "question"
import { researchCode } from "../agents/chat/research";
import { DONT_KNOW, markCitations, writeAnswer } from "../agents/chat/writer";
import { aiPlatform } from "../services/aiPlatform";
import { createCodeSearch } from "../services/codeSearch";
import { meteredLlm } from "../services/llm";
import { openBindings } from "./platform";

const question = process.argv.slice(2).join(" ") || "What is the minimum clear width of an egress door?";
const { env, dispose } = await openBindings();
try {
  const ai = aiPlatform(env);
  const llm = meteredLlm(ai.llm);
  const search = createCodeSearch({ db: env.DB, index: ai.index, embedder: ai.embedder });
  const evidence = await researchCode(search, question);
  console.log(`passages: ${evidence.map((e) => (e.kind === "code" ? `[${e.id}] §${e.section}` : "")).join("  ") || "none"}`);
  const r = evidence.length ? await writeAnswer(llm, { message: question, evidence, needsCode: true }) : null;
  if (!r || !r.enough) console.log(DONT_KNOW);
  else {
    console.log(markCitations(r.answer, r.cites));
    for (const e of evidence.filter((x) => r.cites.includes(x.id))) if (e.kind === "code") console.log(`  [${e.id}] NYC BC §${e.section}, p. ${e.page}: "${e.quote.slice(0, 120)}"`);
  }
  const u = llm.usage();
  console.log(`(${u.llmCalls} LLM call(s), ${u.inputTokens} input + ${u.outputTokens} output tokens)`);
} finally {
  await dispose();
}
