// HTTP client for the Worker API, including the streamed (server-sent events) chat.
import type { CodeHit } from "@shared/codeSearch";
import { type ChatRequest, decodeEvents, type HealthResponse, type StreamEvent } from "@shared/contracts";

export interface ApiClient {
  health(): Promise<HealthResponse>;
  searchCode(q: string): Promise<{ hits: CodeHit[] }>;
  /** Calls `onEvent` for every event; resolves when the stream ends. */
  chat(req: ChatRequest, onEvent: (e: StreamEvent) => void): Promise<void>;
}

export function createApiClient(baseUrl: string, fetchFn: typeof fetch = fetch): ApiClient {
  const base = baseUrl.replace(/\/+$/, "");

  async function fail(res: Response, path: string): Promise<never> {
    const detail = await res.json().then((j: { error?: string }) => j.error, () => undefined);
    throw new Error(detail ?? `${path}: HTTP ${res.status}`);
  }

  async function getJson<T>(path: string): Promise<T> {
    const res = await fetchFn(`${base}${path}`);
    if (!res.ok) return fail(res, path);
    return (await res.json()) as T;
  }

  return {
    health: () => getJson<HealthResponse>("/api/health"),
    searchCode: (q) => getJson(`/api/code/search?${new URLSearchParams({ q })}`),
    async chat(req, onEvent) {
      const res = await fetchFn(`${base}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req),
      });
      if (!res.ok || !res.body) return fail(res, "/api/chat");
      // read the body piece by piece as it arrives, instead of waiting for all of it
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        const out = decodeEvents(buffer + value);
        buffer = out.rest;
        out.events.forEach(onEvent);
      }
    },
  };
}
