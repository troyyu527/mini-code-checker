// POST /api/chat: validate the input, then stream the session agent's run as server-sent events.
import { ChatRequestSchema } from "@shared/contracts";
import type { Env } from "../config";

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return undefined; // not JSON at all: zod reports it below
  }
}

export async function chat(request: Request, env: Env): Promise<Response> {
  const parsed = ChatRequestSchema.safeParse(await readJson(request));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "invalid request" }, { status: 400 });
  // one Durable Object per session id: the same id always reaches the same object
  const agent = env.SESSION.get(env.SESSION.idFromName(parsed.data.sessionId));
  const stream = await agent.chat(parsed.data);
  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" } });
}
