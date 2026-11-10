// Loads the clause file (outside the repo) into the local D1: rows and keyword index. Run: npm run ingest
import { readFileSync } from "node:fs";
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

const { env, dispose } = await openBindings();
try {
  await applySchema(env.DB, readFileSync("db/schema.sql", "utf8"));
  const t = Date.now();
  const { written, unchanged } = await upsertChunks(env.DB, lines);
  console.log(`${lines.length} clauses: ${written} written, ${unchanged} unchanged (${Date.now() - t} ms)`);
} finally {
  await dispose();
}