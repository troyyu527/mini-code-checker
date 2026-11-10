// LLM access: one small interface, with an Ollama (OpenAI-compatible) and a Workers AI implementation.
// The agents only know LlmClient, so tests can pass a fake one and nothing else changes.

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface Usage {
  inputTokens: number;
  outputTokens: number;
}

export interface LlmClient {
  chat(messages: ChatMessage[]): Promise<{ content: string; usage: Usage }>;
}

/** Any OpenAI-style /chat/completions endpoint; locally that is Ollama at http://localhost:11434/v1. */
export function createOpenAiCompatClient(opts: { baseUrl: string; apiKey: string; model: string }, fetchFn: typeof fetch = fetch): LlmClient {
  const url = `${opts.baseUrl.replace(/\/+$/, "")}/chat/completions`;
  return {
    async chat(messages) {
      const res = await fetchFn(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${opts.apiKey}` },
        // temperature 0: the most likely words, so answers change as little as possible between runs
        body: JSON.stringify({ model: opts.model, messages, temperature: 0, reasoning_effort: "none" }),
      });
      if (!res.ok) throw new Error(`LLM HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
      const body = (await res.json()) as {
        choices: { message: { content?: string | null } }[];
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };
      return {
        content: body.choices[0]?.message.content ?? "",
        usage: { inputTokens: body.usage?.prompt_tokens ?? 0, outputTokens: body.usage?.completion_tokens ?? 0 },
      };
    },
  };
}

/**
 * A Workers AI chat model through the AI binding. Qwen3 "thinks" before answering unless the system message ends
 * with /no_think; the thinking would cost many times the answer's tokens.
 */
export function createWorkersAiClient(ai: Ai, model = "@cf/qwen/qwen3-30b-a3b-fp8"): LlmClient {
  return {
    async chat(messages) {
      const [first, ...rest] = messages;
      const sent = first?.role === "system" ? [{ ...first, content: `${first.content}\n/no_think` }, ...rest] : messages;
      const body = (await ai.run(model as keyof AiModels, { messages: sent, temperature: 0, max_tokens: 1024 } as never)) as unknown as {
        choices: { message: { content?: string | null } }[];
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };
      return {
        content: (body.choices[0]?.message.content ?? "").trim(),
        usage: { inputTokens: body.usage?.prompt_tokens ?? 0, outputTokens: body.usage?.completion_tokens ?? 0 },
      };
    },
  };
}

/** Wraps a client and adds up the usage of every call that goes through it. */
export function meteredLlm(llm: LlmClient): LlmClient & { usage(): Usage & { llmCalls: number } } {
  const total = { llmCalls: 0, inputTokens: 0, outputTokens: 0 };
  return {
    async chat(messages) {
      const res = await llm.chat(messages);
      total.llmCalls++;
      total.inputTokens += res.usage.inputTokens;
      total.outputTokens += res.usage.outputTokens;
      return res;
    },
    usage: () => ({ ...total }),
  };
}

/** Text → vectors (bge-small-en-v1.5: 384 numbers per text). */
export interface Embedder {
  embed(texts: string[]): Promise<number[][]>;
}

export function createOpenAiCompatEmbedder(opts: { baseUrl: string; apiKey: string; model: string }, fetchFn: typeof fetch = fetch): Embedder {
  const url = `${opts.baseUrl.replace(/\/+$/, "")}/embeddings`;
  return {
    async embed(texts) {
      if (!texts.length) return [];
      const res = await fetchFn(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${opts.apiKey}` },
        body: JSON.stringify({ model: opts.model, input: texts }),
      });
      if (!res.ok) throw new Error(`Embeddings HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
      const body = (await res.json()) as { data: { index: number; embedding: number[] }[] };
      return [...body.data].sort((a, b) => a.index - b.index).map((d) => d.embedding);
    },
  };
}

export function createWorkersAiEmbedder(ai: Ai, model = "@cf/baai/bge-small-en-v1.5"): Embedder {
  return {
    async embed(texts) {
      const out: number[][] = [];
      for (let i = 0; i < texts.length; i += 100) {
        const res = (await ai.run(model as keyof AiModels, { text: texts.slice(i, i + 100) } as never)) as unknown as { data: number[][] };
        out.push(...res.data);
      }
      return out;
    },
  };
}
