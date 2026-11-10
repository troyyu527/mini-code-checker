// GET /api/code/search?q=…&k=…  → { hits }. Lesson 24 searches the real clauses; for now the input check is real.
import { CodeSearchQuerySchema, type CodeHit } from "@shared/codeSearch";

export async function codeSearch(request: Request): Promise<Response> {
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const parsed = CodeSearchQuerySchema.safeParse(params);
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "invalid query" }, { status: 400 });
  console.log(JSON.stringify({ event: "code_search", q: parsed.data.q, k: parsed.data.k }));
  const hits: CodeHit[] = [];
  return Response.json({ hits });
}