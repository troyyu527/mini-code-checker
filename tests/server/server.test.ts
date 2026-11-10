import { describe, expect, it } from "vitest";
import type { Env } from "../../server/config";
import { readFileSync } from "node:fs";
import { handle } from "../../server/main";
import { applySchema } from "../../server/services/modelData";
import { memoryD1 } from "../fakes/d1";

const DB = memoryD1();
await applySchema(DB, readFileSync("db/schema.sql", "utf8")); // empty tables: the routes work, searches find nothing
const env = { ALLOWED_ORIGINS: "http://localhost:5173", DB } as Env;
const get = (path: string) => handle(new Request(`http://worker${path}`), env);

describe("Worker routes", () => {
  it("health answers JSON", async () => {
    const res = await get("/api/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, version: "0.1.0" });
  });
  it("unknown paths are 404", async () => {
    expect((await get("/api/nope")).status).toBe(404);
  });
  it("a POST to the health route is 404 too (method and path must both match)", async () => {
    expect((await handle(new Request("http://worker/api/health", { method: "POST" }), env)).status).toBe(404);
  });
  it("a bad search query is 400 with a reason", async () => {
    const res = await get("/api/code/search?q=a");
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toMatch(/2 characters/);
  });
  it("k above 10 is refused (a valid search is tested in codeSearch.test.ts with a fake embedder)", async () => {
    expect((await get("/api/code/search?q=door&k=99")).status).toBe(400);
  });
  it("a chat body that is not JSON is 400", async () => {
    const res = await handle(new Request("http://worker/api/chat", { method: "POST", body: "not json" }), env);
    expect(res.status).toBe(400);
  });
  it("a valid chat request is handed to the session's Durable Object and streamed back", async () => {
    const asked: string[] = [];
    const SESSION = {
      idFromName: (name: string) => (asked.push(name), name),
      get: () => ({ chat: async () => new Response("data: {}\n\n").body! }),
    };
    const body = JSON.stringify({ sessionId: "s-12345678", message: "Why does D-104 fail?" });
    const res = await handle(new Request("http://worker/api/chat", { method: "POST", body }), { ...env, SESSION } as unknown as Env);
    expect(res.headers.get("Content-Type")).toBe("text/event-stream");
    expect(asked).toEqual(["s-12345678"]);
  });
});
