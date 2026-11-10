import { describe, expect, it } from "vitest";
import { createOpenAiCompatClient, meteredLlm } from "../../server/services/llm";
import { scriptedLlm } from "../fakes/llm";

/** A fetch that answers like Ollama's /v1/chat/completions and remembers what was sent. */
function fakeOllama(status = 200) {
  const sent: { url: string; body: Record<string, unknown> }[] = [];
  const fn = (async (url: string, init: RequestInit) => {
    sent.push({ url, body: JSON.parse(String(init.body)) });
    if (status !== 200) return new Response("model not found", { status });
    return Response.json({ choices: [{ message: { content: "Hello." } }], usage: { prompt_tokens: 19, completion_tokens: 3 } });
  }) as unknown as typeof fetch;
  return { fn, sent };
}

describe("OpenAI-compatible client", () => {
  it("sends the model, the messages, temperature 0 and no thinking; reads content and usage", async () => {
    const { fn, sent } = fakeOllama();
    const llm = createOpenAiCompatClient({ baseUrl: "http://localhost:11434/v1/", apiKey: "ollama", model: "gemma4:12b" }, fn);
    const res = await llm.chat([{ role: "user", content: "Say hello" }]);
    expect(sent[0].url).toBe("http://localhost:11434/v1/chat/completions");
    expect(sent[0].body).toMatchObject({ model: "gemma4:12b", temperature: 0, reasoning_effort: "none" });
    expect(res).toEqual({ content: "Hello.", usage: { inputTokens: 19, outputTokens: 3 } });
  });
  it("throws with the status and the reason when the server says no", async () => {
    const llm = createOpenAiCompatClient({ baseUrl: "http://x/v1", apiKey: "k", model: "nope" }, fakeOllama(404).fn);
    await expect(llm.chat([{ role: "user", content: "hi" }])).rejects.toThrow("LLM HTTP 404: model not found");
  });
});

describe("meteredLlm", () => {
  it("adds up the calls and tokens of every call", async () => {
    const llm = meteredLlm(scriptedLlm(["a", "b"]));
    await llm.chat([]);
    await llm.chat([]);
    expect(llm.usage()).toEqual({ llmCalls: 2, inputTokens: 20, outputTokens: 10 });
  });
});