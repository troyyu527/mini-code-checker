// Scores the chat supervisor's routing against tests/golden/routing.json.
// Run: npm run eval:routing            local D1 and Ollama
//      npm run eval:routing -- --remote the deployed D1 and Workers AI (the model the live site uses)
import { readFileSync } from "node:fs";
import { supervise } from "../agents/chat/supervisor";
import { aiPlatform } from "../services/aiPlatform";
import { getFacts, getFindings } from "../services/modelData";
import { openBindings } from "./platform";

const cases = JSON.parse(readFileSync("tests/golden/routing.json", "utf8")) as { message: string; route: string }[];

const { env, remote, dispose } = await openBindings();
try {
  const ai = aiPlatform(env);
  const [facts, findings] = [await getFacts(env.DB), await getFindings(env.DB)];
  console.log(`${remote ? "deployed" : "local"}: ${ai.model}`);
  let right = 0;
  for (const c of cases) {
    const d = await supervise(ai.llm, { message: c.message, facts, findings });
    const ok = d.route === c.route;
    if (ok) right++;
    console.log(`${ok ? "ok  " : "MISS"} ${d.route.padEnd(8)} (want ${c.route.padEnd(8)}) ${c.message}`);
  }
  console.log(`${right}/${cases.length} routed right`);
} finally {
  await dispose();
}
