// GET /api/code/search?q=…&k=…  → { hits }
import { CodeSearchQuerySchema } from "@shared/codeSearch";
import { embeddingConfig, type Env } from "../config";
import { createCodeSearch } from "../services/codeSearch";
import { createOpenAiCompatEmbedder } from "../services/llm";
import { createD1VectorIndex } from "../services/vectorIndex";

export async function codeSearch(request: Request, env: Env): Promise<Response> {
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const parsed = CodeSearchQuerySchema.safeParse(params);
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "invalid query" }, { status: 400 });
  console.log(JSON.stringify({ event: "code_search", q: parsed.data.q, k: parsed.data.k }));
  const search = createCodeSearch({ db: env.DB, index: createD1VectorIndex(env.DB), embedder: createOpenAiCompatEmbedder(embeddingConfig(env)) });
  return Response.json({ hits: await search.search(parsed.data.q, parsed.data.k) });
}