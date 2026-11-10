// Runs one chat message through the chat graph against the local D1 and Ollama, printing each step. Run: npm run chat -- "message"
import { buildChatGraph, runChat, toResponse } from "../agents/chat/graph";
import { embeddingConfig } from "../config";
import { createCodeSearch } from "../services/codeSearch";
import { createOpenAiCompatClient, createOpenAiCompatEmbedder, meteredLlm } from "../services/llm";
import { getFacts, getFindings } from "../services/modelData";
import { createD1VectorIndex } from "../services/vectorIndex";
import { openBindings } from "./platform";

const message = process.argv.slice(2).join(" ") || "Why does D-104 fail?";
const { env, dispose } = await openBindings();
try {
  const llm = meteredLlm(createOpenAiCompatClient({ baseUrl: env.OLLAMA_BASE_URL!, apiKey: env.OLLAMA_API_KEY ?? "ollama", model: env.OLLAMA_MODEL! }));
  const graph = buildChatGraph({
    llm,
    search: createCodeSearch({ db: env.DB, index: createD1VectorIndex(env.DB), embedder: createOpenAiCompatEmbedder(embeddingConfig(env)) }),
    facts: () => getFacts(env.DB),
    findings: (ids) => getFindings(env.DB, ids),
  });
  const state = await runChat(graph, crypto.randomUUID(), message, (s) => console.log(`  ${s.agent.padEnd(10)} ${s.summary}${s.ms !== undefined ? ` (${s.ms} ms)` : ""}`));
  const r = toResponse(state, llm.usage());
  console.log(`route: ${r.route}\n${r.answer}`);
  for (const e of r.evidence) console.log(`  [${e.id}] ${e.kind === "code" ? `NYC BC §${e.section}` : `${e.findingId} ${e.element}: ${e.fact}`}`);
  if (r.viewerCommands.length) console.log(`viewer: ${r.viewerCommands.map((c) => c.action).join(", ")}`);
  console.log(`(${r.usage.llmCalls} LLM call(s), ${r.usage.inputTokens} + ${r.usage.outputTokens} tokens)`);
} finally {
  await dispose();
}