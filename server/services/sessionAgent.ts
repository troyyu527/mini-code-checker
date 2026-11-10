// SessionAgent Durable Object: one per visitor session. Runs the chat graph and streams each agent step to the
// browser as a server-sent event. (Lesson 32 adds the budget guard and the choice between Ollama and Workers AI.)
import { AsyncLocalStorage } from "node:async_hooks";
import { DurableObject } from "cloudflare:workers";
import { AsyncLocalStorageProviderSingleton } from "@langchain/core/singletons";
import { type ChatRequest, encodeEvent, type StreamEvent } from "@shared/contracts";
import { buildChatGraph, runChat, toResponse } from "../agents/chat/graph";
import { embeddingConfig, type Env } from "../config";
import { createCodeSearch } from "./codeSearch";
import { createOpenAiCompatClient, createOpenAiCompatEmbedder, meteredLlm } from "./llm";
import { getFacts, getFindings } from "./modelData";
import { createD1VectorIndex } from "./vectorIndex";

// Wrangler bundles LangGraph's browser build, which does not set this up; LangGraph needs it to track its runs.
AsyncLocalStorageProviderSingleton.initializeGlobalInstance(new AsyncLocalStorage());

type Send = (event: StreamEvent) => void;

/** A stream that `run` writes events into; if `run` throws, the error becomes an error event. */
export function eventStream(run: (send: Send) => Promise<void>): ReadableStream<Uint8Array> {
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();
  const send: Send = (e) => void writer.write(encoder.encode(encodeEvent(e))).catch(() => {});
  void run(send)
    .catch((e: unknown) => {
      console.error("chat run failed", e);
      send({ type: "error", error: "The assistant failed. Please try again." });
    })
    .finally(() => writer.close().catch(() => {}));
  return readable; // returned at once; events arrive while `run` goes on
}

export class SessionAgent extends DurableObject<Env> {
  chat(req: ChatRequest): ReadableStream<Uint8Array> {
    return eventStream(async (send) => {
      const env = this.env;
      const llm = meteredLlm(createOpenAiCompatClient({ baseUrl: env.OLLAMA_BASE_URL!, apiKey: env.OLLAMA_API_KEY ?? "ollama", model: env.OLLAMA_MODEL! }));
      const graph = buildChatGraph({
        llm,
        search: createCodeSearch({ db: env.DB, index: createD1VectorIndex(env.DB), embedder: createOpenAiCompatEmbedder(embeddingConfig(env)) }),
        facts: () => getFacts(env.DB),
        findings: (ids) => getFindings(env.DB, ids),
      });
      const state = await runChat(graph, crypto.randomUUID(), req.message, (step) => send({ type: "trace", step }));
      send({ type: "result", result: toResponse(state, llm.usage()) });
    });
  }
}