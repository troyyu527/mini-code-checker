// Loads the clause file (outside the repo) into the local D1: rows, keyword index and vectors. Run: npm run ingest
import { readFileSync } from "node:fs";
import { embeddingConfig } from "../config";
import { type ClauseLine, upsertChunks } from "../services/codeSearch";
import { createOpenAiCompatEmbedder } from "../services/llm";
import { applySchema } from "../services/modelData";
import { createD1VectorIndex } from "../services/vectorIndex";
import { openBindings } from "./platform";

// Node does not read .env by itself; process.loadEnvFile (built into Node 20.12+) copies it into process.env
process.loadEnvFile(".env");
const path = process.env.CLAUSES_PATH;
if (!path) throw new Error("CLAUSES_PATH is not set (see .env.example)");

const lines = readFileSync(path, "utf8")
  .split("\n")
  .filter((l) => l.trim())
  .map((l) => JSON.parse(l) as ClauseLine);

const { env, dispose } = await openBindings();
try {
  await applySchema(env.DB, readFileSync("db/schema.sql", "utf8"));
  const embedder = createOpenAiCompatEmbedder(embeddingConfig(env));
  const t = Date.now();
  const { written, unchanged } = await upsertChunks(env.DB, createD1VectorIndex(env.DB), embedder, lines, (done) => process.stdout.write(`\rembedded ${done}`));
  console.log(`\n${lines.length} clauses: ${written} written, ${unchanged} unchanged (${Date.now() - t} ms)`);
} finally {
  await dispose();
}