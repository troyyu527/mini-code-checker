import { describe, expect, it } from "vitest";
import type { Env } from "../../server/config";
import { handle } from "../../server/main";

const env = { ALLOWED_ORIGINS: "http://localhost:5173" } as Env;
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
});