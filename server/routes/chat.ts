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

/** Cloudflare puts the visitor's IP address in CF-Connecting-IP. Only a hash is stored: the limit needs to tell
 *  visitors apart, not to know who they are. */
export async function visitorKey(request: Request): Promise<string> {
  const ip = request.headers.get("CF-Connecting-IP") ?? "local";
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(ip));
  return [...new Uint8Array(hash).slice(0, 8)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function chat(request: Request, env: Env): Promise<Response> {
  const parsed = ChatRequestSchema.safeParse(await readJson(request));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "invalid request" }, { status: 400 });
  // one Durable Object per session id: the same id always reaches the same object
  const agent = env.SESSION.get(env.SESSION.idFromName(parsed.data.sessionId));
  const stream = await agent.chat(parsed.data, await visitorKey(request));
  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" } });
}
