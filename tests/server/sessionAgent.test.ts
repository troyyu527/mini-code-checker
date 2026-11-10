// The SessionAgent Durable Object itself, with fakes at every edge: an in-memory D1 with the sample report,
// a budget ledger on in-memory SQLite, and a fake Ollama behind a stubbed global fetch.
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { decodeEvents } from "@shared/contracts";
import type { Env, Limits } from "../../server/config";
import { BudgetLedger } from "../../server/services/budgetGuard";
import { applySchema, saveModelAndReport } from "../../server/services/modelData";
import { SessionAgent } from "../../server/services/sessionAgent";
import { memoryD1 } from "../fakes/d1";
import { FAKE_REPORT } from "../fakes/report";
import { memorySql } from "../fakes/sqlite";

const facts = FAKE_REPORT.findings.map((f, i) => ({
  globalId: f.globalId, expressId: i, ifcType: f.ifcType, name: f.element, longName: null, objectType: null, storey: f.storey, dims: {},
}));

/** Every LLM call gets the next reply (or an HTTP error); returns the URLs that were called. */
function fakeOllama(replies: (string | number)[]) {
  const urls: string[] = [];
  vi.stubGlobal("fetch", async (url: string) => {
    urls.push(String(url));
    const next = replies.shift();
    if (typeof next === "number") return new Response("model not found", { status: next });
    return Response.json({ choices: [{ message: { content: next } }], usage: { prompt_tokens: 100, completion_tokens: 20 } });
  });
  return urls;
}

async function agentWith(limits: Limits) {
  const db = memoryD1();
  await applySchema(db, readFileSync("db/schema.sql", "utf8"));
  await saveModelAndReport(db, facts, FAKE_REPORT);
  const sql = memorySql();
  const ledger = new BudgetLedger(sql, limits, () => "2026-11-10");
  const env = {
    AI_PROVIDER: "ollama",
    OLLAMA_BASE_URL: "http://ollama.test/v1",
    OLLAMA_MODEL: "test-model",
    OLLAMA_EMBEDDING_MODEL: "test-embedder",
    DB: db,
    BUDGET: { idFromName: () => "global", get: () => ledger }, // the stub answers like the real BudgetGuard
  } as unknown as Env;
  const tokens = () => Number(sql.exec("SELECT value FROM budget WHERE key = 'tokens'").toArray()[0]?.value ?? 0);
  return { agent: new SessionAgent({} as DurableObjectState, env), tokens };
}

const eventsOf = async (stream: ReadableStream<Uint8Array>) => decodeEvents(await new Response(stream).text()).events;
const ask = (message: string) => ({ sessionId: "s-12345678", message });
const LIMITS = { dailyTokens: 1000, sessionMessages: 20 };

afterEach(() => vi.unstubAllGlobals());

describe("SessionAgent.chat", () => {
  it("answers a question about a finding, streams every step, and records the tokens", async () => {
    const urls = fakeOllama(['{"answer": "D-104 is 762 mm wide, the code asks for 812.8 mm [E1].", "cites": ["E1"], "enough": true}']);
    const { agent, tokens } = await agentWith(LIMITS);
    const events = await eventsOf(agent.chat(ask("Why does D-104 fail?")));
    expect(events.map((e) => (e.type === "trace" ? e.step.agent : e.type))).toEqual(["supervisor", "findings", "writer", "result"]);
    expect(urls).toEqual(["http://ollama.test/v1/chat/completions"]); // the route was found by code: one LLM call
    expect(tokens()).toBe(120);
  });

  it("a refused message runs nothing and costs nothing", async () => {
    const urls = fakeOllama([]);
    const { agent, tokens } = await agentWith({ ...LIMITS, sessionMessages: 0 });
    const events = await eventsOf(agent.chat(ask("Why does D-104 fail?")));
    expect(events).toEqual([{ type: "error", error: "This session has used its 0 messages for today. The report keeps working.", notice: true }]);
    expect(urls).toEqual([]);
    expect(tokens()).toBe(0);
  });

  it("when the LLM is down, the visitor gets a plain error event and no internals", async () => {
    fakeOllama([404]);
    const { agent } = await agentWith(LIMITS);
    vi.spyOn(console, "error").mockImplementation(() => {}); // the full error goes to the log; keep the test output clean
    const events = await eventsOf(agent.chat(ask("Why does D-104 fail?")));
    expect(events.at(-1)).toEqual({ type: "error", error: "The assistant failed. Please try again." });
    expect(JSON.stringify(events)).not.toContain("model not found");
  });
});
