// Sends one question to the local LLM and prints the answer and the token usage. Run: npm run ask -- "your question"
import { createOpenAiCompatClient } from "../services/llm";

process.loadEnvFile(".env");
const question = process.argv.slice(2).join(" ") || "In one sentence: what is a means of egress?";
const llm = createOpenAiCompatClient({
  baseUrl: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434/v1",
  apiKey: process.env.OLLAMA_API_KEY ?? "ollama",
  model: process.env.OLLAMA_MODEL ?? "gemma4:12b",
});
const t = Date.now();
const res = await llm.chat([
  { role: "system", content: "You answer questions about building codes in at most two sentences." },
  { role: "user", content: question },
]);
console.log(res.content);
console.log(`(${res.usage.inputTokens} input + ${res.usage.outputTokens} output tokens, ${Date.now() - t} ms)`);