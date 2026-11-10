// The budget ledger on an in-memory SQLite, the Workers AI client with a fake AI binding, and the platform choice.
import { describe, expect, it } from "vitest";
import type { Env } from "../../server/config";
import { readLimits } from "../../server/config";
import { aiPlatform } from "../../server/services/aiPlatform";
import { BUDGET_NOTICE, BudgetLedger } from "../../server/services/budgetGuard";
import { createWorkersAiClient } from "../../server/services/llm";
import { memorySql } from "../fakes/sqlite";

describe("BudgetLedger", () => {
  it("stops a session at its message limit", () => {
    const ledger = new BudgetLedger(memorySql(), { dailyTokens: 1000, sessionMessages: 2 }, () => "2026-11-09");
    expect([ledger.reserve("s1").ok, ledger.reserve("s1").ok, ledger.reserve("s1").ok]).toEqual([true, true, false]);
    expect(ledger.reserve("s2").ok).toBe(true); // other sessions are not affected
  });
  it("stops everyone when the daily tokens are used up, and starts again the next day", () => {
    let day = "2026-11-09";
    const ledger = new BudgetLedger(memorySql(), { dailyTokens: 1000, sessionMessages: 20 }, () => day);
    ledger.record(999);
    expect(ledger.reserve("s1").ok).toBe(true); // 999 < 1000
    ledger.record(1);
    expect(ledger.reserve("s1")).toEqual({ ok: false, notice: BUDGET_NOTICE }); // 1000 ≥ 1000
    day = "2026-11-10";
    expect(ledger.reserve("s1").ok).toBe(true);
  });
});

describe("readLimits", () => {
  it("uses the defaults unless a setting is a number", () => {
    expect(readLimits({})).toEqual({ dailyTokens: 200_000, sessionMessages: 20 });
    expect(readLimits({ DAILY_TOKEN_LIMIT: "2000", SESSION_MESSAGE_LIMIT: "lots" })).toEqual({ dailyTokens: 2000, sessionMessages: 20 });
  });
});

describe("Workers AI client", () => {
  it("adds /no_think to the system message and reads content and usage", async () => {
    const calls: { model: string; input: { messages: { role: string; content: string }[] } }[] = [];
    const ai = {
      run: async (model: string, input: never) => {
        calls.push({ model, input });
        return { choices: [{ message: { content: " Hello. " } }], usage: { prompt_tokens: 30, completion_tokens: 4 } };
      },
    } as unknown as Ai;
    const res = await createWorkersAiClient(ai).chat([{ role: "system", content: "Be brief." }, { role: "user", content: "Hi" }]);
    expect(calls[0].model).toBe("@cf/qwen/qwen3-30b-a3b-fp8");
    expect(calls[0].input.messages[0].content).toBe("Be brief.\n/no_think");
    expect(res).toEqual({ content: "Hello.", usage: { inputTokens: 30, outputTokens: 4 } });
  });
});

describe("aiPlatform", () => {
  const local = { AI_PROVIDER: "ollama", OLLAMA_BASE_URL: "http://localhost:11434/v1", OLLAMA_MODEL: "gemma4:12b", OLLAMA_EMBEDDING_MODEL: "bge" } as Env;
  it("uses Ollama locally", () => {
    expect(aiPlatform(local)).toMatchObject({ provider: "ollama", model: "gemma4:12b" });
  });
  it("says which setting is missing", () => {
    expect(() => aiPlatform({ ...local, OLLAMA_MODEL: undefined })).toThrow("OLLAMA_MODEL is not set");
  });
  it("refuses Workers AI without its bindings", () => {
    expect(() => aiPlatform({ ...local, AI_PROVIDER: "workers-ai" })).toThrow("needs the AI and CODE_INDEX bindings");
  });
});
