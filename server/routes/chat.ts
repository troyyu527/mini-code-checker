// POST /api/chat: validate the input. Lesson 31 streams the agent's answer; for now the route says it is not built yet.
import { ChatRequestSchema } from "@shared/contracts";

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return undefined; // not JSON at all: zod reports it below
  }
}

export async function chat(request: Request): Promise<Response> {
  const parsed = ChatRequestSchema.safeParse(await readJson(request));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "invalid request" }, { status: 400 });
  return Response.json({ error: "the assistant is not built yet" }, { status: 501 });
}