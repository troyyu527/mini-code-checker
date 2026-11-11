// Loads the clause file (outside the repo): rows and keyword index in D1, vectors in the local D1 table or, with
// --remote, in Vectorize (embedded by Workers AI). Run: npm run ingest [-- --remote]
import { readFileSync } from "node:fs";
import { aiPlatform } from "../services/aiPlatform";
import { type ClauseLine, upsertChunks } from "../services/codeSearch";
import { applySchema } from "../services/modelData";
import { openBindings } from "./platform";

// Node does not read .env by itself; process.loadEnvFile (built into Node 20.12+) copies it into process.env
process.loadEnvFile(".env");
const path = process.env.CLAUSES_PATH;
if (!path) throw new Error("CLAUSES_PATH is not set (see .env.example)");

const lines = readFileSync(path, "utf8")
  .split("\n")
  .filter((l) => l.trim())
  .map((l) => JSON.parse(l) as ClauseLine);

const { env, remote, dispose } = await openBindings();
try {
  await applySchema(env.DB, readFileSync("db/schema.sql", "utf8"));
  const ai = aiPlatform(env);
  console.log(`${remote ? "deployed" : "local"}: ${ai.provider} embeddings, ${remote ? "Vectorize" : "D1 vector table"}`);
  const t = Date.now();
  const { written, unchanged } = await upsertChunks(env.DB, ai.index, ai.embedder, lines, (done) => process.stdout.write(`\rembedded ${done}`));
  console.log(`\n${lines.length} clauses: ${written} written, ${unchanged} unchanged (${Date.now() - t} ms)`);
} finally {
  await dispose();
}
