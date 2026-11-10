// SessionAgent Durable Object: one per visitor session. Asks the budget guard, runs the chat graph, and streams
// each agent step to the browser as a server-sent event.
import { AsyncLocalStorage } from "node:async_hooks";
import { DurableObject } from "cloudflare:workers";
import { AsyncLocalStorageProviderSingleton } from "@langchain/core/singletons";
import { type ChatRequest, encodeEvent, type StreamEvent } from "@shared/contracts";
import { buildChatGraph, runChat, toResponse } from "../agents/chat/graph";
import type { Env } from "../config";
import { aiPlatform } from "./aiPlatform";
import { createCodeSearch } from "./codeSearch";
import { meteredLlm } from "./llm";
import { getFacts, getFindings } from "./modelData";

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
  /** `visitor`: a hash of the visitor's IP address (see routes/chat.ts). */
  chat(req: ChatRequest, visitor?: string): ReadableStream<Uint8Array> {
    return eventStream(async (send) => {
      const budget = this.env.BUDGET.get(this.env.BUDGET.idFromName("global"));
      const gate = await budget.reserve(req.sessionId, visitor);
      if (!gate.ok) return send({ type: "error", error: gate.notice, notice: true });

      const ai = aiPlatform(this.env);
      const llm = meteredLlm(ai.llm);
      const graph = buildChatGraph({
        llm,
        search: createCodeSearch({ db: this.env.DB, index: ai.index, embedder: ai.embedder }),
        facts: () => getFacts(this.env.DB),
        findings: (ids) => getFindings(this.env.DB, ids),
      });
      const state = await runChat(graph, crypto.randomUUID(), req.message, (step) => send({ type: "trace", step }));
      const usage = llm.usage();
      await budget.record(usage.inputTokens + usage.outputTokens);
      send({ type: "result", result: toResponse(state, usage) });
    });
  }
}
