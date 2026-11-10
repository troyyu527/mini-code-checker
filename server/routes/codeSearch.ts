// GET /api/code/search?q=…&k=…  → { hits }
import { CodeSearchQuerySchema } from "@shared/codeSearch";
import type { Env } from "../config";
import { aiPlatform } from "../services/aiPlatform";
import { createCodeSearch } from "../services/codeSearch";

export async function codeSearch(request: Request, env: Env): Promise<Response> {
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const parsed = CodeSearchQuerySchema.safeParse(params);
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "invalid query" }, { status: 400 });
  console.log(JSON.stringify({ event: "code_search", q: parsed.data.q, k: parsed.data.k }));
  const ai = aiPlatform(env);
  const search = createCodeSearch({ db: env.DB, index: ai.index, embedder: ai.embedder });
  const hits = await search.search(parsed.data.q, parsed.data.k);
  return Response.json({ hits });
}
