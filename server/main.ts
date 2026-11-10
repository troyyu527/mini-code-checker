// Worker entry: routes each request to its handler. Lesson 22 adds input checks, lesson 33 adds CORS.
import { type Config, type Env, readConfig } from "./config";
import { health } from "./routes/health";

async function route(request: Request, _env: Env, config: Config): Promise<Response> {
  const { pathname } = new URL(request.url);
  const { method } = request;
  if (method === "GET" && pathname === "/api/health") return health(config);
  return Response.json({ error: "not found" }, { status: 404 });
}

export async function handle(request: Request, env: Env): Promise<Response> {
  const config = readConfig(env);
  try {
    return await route(request, env, config);
  } catch (e) {
    // the full error goes to the log (wrangler dev terminal, wrangler tail); the visitor gets no internals
    console.error("request failed", request.method, new URL(request.url).pathname, e);
    return Response.json({ error: "internal error" }, { status: 500 });
  }
}

export default { fetch: handle } satisfies ExportedHandler<Env>;