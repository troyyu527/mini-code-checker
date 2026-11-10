// Worker entry: checks the origin (CORS), routes each request, and adds the CORS headers to the answer.
import { type Config, type Env, readConfig } from "./config";
import { chat } from "./routes/chat";
import { codeSearch } from "./routes/codeSearch";
import { health } from "./routes/health";

// Durable Object classes must be exported from the entry file
export { BudgetGuard } from "./services/budgetGuard";
export { SessionAgent } from "./services/sessionAgent";

function corsHeaders(origin: string): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

async function route(request: Request, env: Env, config: Config): Promise<Response> {
  const { pathname } = new URL(request.url);
  const { method } = request;
  if (method === "GET" && pathname === "/api/health") return health(config);
  if (method === "GET" && pathname === "/api/code/search") return codeSearch(request, env);
  if (method === "POST" && pathname === "/api/chat") return chat(request, env);
  return Response.json({ error: "not found" }, { status: 404 });
}

export async function handle(request: Request, env: Env): Promise<Response> {
  const config = readConfig(env);
  const origin = request.headers.get("Origin");

  // Browsers send Origin on cross-site requests; a site that is not on our list is refused.
  if (origin !== null && !config.allowedOrigins.includes(origin)) {
    return Response.json({ error: "origin not allowed" }, { status: 403 });
  }
  // The browser's "preflight" question before a POST with JSON: answer with the allowed methods and headers.
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: origin ? corsHeaders(origin) : {} });
  }

  let response: Response;
  try {
    response = await route(request, env, config);
  } catch (e) {
    // the full error goes to the log (wrangler dev terminal, wrangler tail); the visitor gets no internals
    console.error("request failed", request.method, new URL(request.url).pathname, e);
    response = Response.json({ error: "internal error" }, { status: 500 });
  }
  if (!origin) return response;
  const headers = new Headers(response.headers);
  for (const [k, v] of Object.entries(corsHeaders(origin))) headers.set(k, v);
  return new Response(response.body, { status: response.status, headers });
}

export default { fetch: handle } satisfies ExportedHandler<Env>;
