// Scores code search on the golden questions for each mode. Run: npm run eval:search (needs Ollama and `npm run ingest`)
import { readFileSync } from "node:fs";
import { firstHitRank, scoreSearch } from "@shared/evaluate";
import { aiPlatform } from "../services/aiPlatform";
import { createCodeSearch, type SearchMode } from "../services/codeSearch";
import { openBindings } from "./platform";

const golden = JSON.parse(readFileSync("tests/golden/search.json", "utf8")) as { q: string; expect: string[] }[];
const MODES: SearchMode[] = ["keyword", "vector", "hybrid"];

const { env, dispose } = await openBindings();
try {
  const ai = aiPlatform(env);
  const search = createCodeSearch({ db: env.DB, index: ai.index, embedder: ai.embedder });
  const misses: string[] = [];
  console.log("mode      hit@1  hit@5  MRR   (questions)");
  for (const mode of MODES) {
    const ranks: (number | null)[] = [];
    for (const g of golden) {
      const hits = await search.search(g.q, 5, mode);
      const rank = firstHitRank(hits.map((h) => h.provisions), g.expect);
      ranks.push(rank);
      if (mode === "hybrid" && rank !== 1) misses.push(`  rank ${rank ?? "-"}  ${g.q}  (expected §${g.expect.join(", §")}; got §${hits[0]?.section ?? "nothing"})`);
    }
    const s = scoreSearch(ranks);
    const pct = (x: number) => `${Math.round(x * 100)}%`.padStart(5);
    console.log(`${mode.padEnd(8)} ${pct(s.hitAt1)}  ${pct(s.hitAt5)}  ${s.mrr.toFixed(2)}  (${s.questions})`);
  }
  console.log(`\nhybrid: not first (${misses.length}):\n${misses.join("\n")}`);
} finally {
  await dispose();
}
