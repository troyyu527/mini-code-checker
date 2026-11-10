// LLM access: one small interface and its OpenAI-compatible implementation (Ollama locally). Lesson 32 adds Workers AI.
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
