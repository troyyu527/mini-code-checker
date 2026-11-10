// The API client reading the SSE stream, and the chat store driving messages and 3D commands from the events.
import { beforeEach, describe, expect, it } from "vitest";
import { type AgentResponse, encodeEvent, type StreamEvent } from "@shared/contracts";
import { type ApiClient, createApiClient } from "../../client/services/apiClient";
import { useChatStore } from "../../client/state/chatStore";
import { useViewerStore } from "../../client/state/viewerStore";

describe("apiClient.chat", () => {
  it("reads the SSE stream even when a chunk ends in the middle of an event", async () => {
    const text = encodeEvent({ type: "trace", step: { agent: "supervisor", summary: "route" } }) + encodeEvent({ type: "error", error: "x" });
    const body = new ReadableStream<Uint8Array>({
      start(c) {
        const bytes = new TextEncoder().encode(text);
        c.enqueue(bytes.slice(0, 20)); // cut on purpose
        c.enqueue(bytes.slice(20));
        c.close();
      },
    });
    const fakeFetch = (async () => new Response(body, { headers: { "Content-Type": "text/event-stream" } })) as typeof fetch;
    const events: string[] = [];
    await createApiClient("http://api", fakeFetch).chat({ sessionId: "s-12345678", message: "hi" }, (e) => events.push(e.type));
    expect(events).toEqual(["trace", "error"]);
  });
  it("throws the server's error message on a 400", async () => {
    const fakeFetch = (async () => Response.json({ error: "message too long" }, { status: 400 })) as typeof fetch;
    await expect(createApiClient("http://api", fakeFetch).chat({ sessionId: "s-12345678", message: "hi" }, () => {})).rejects.toThrow("message too long");
  });
});

/** An ApiClient whose chat plays the given events. */
const playing = (events: StreamEvent[]): ApiClient => ({
  health: async () => ({ ok: true, version: "test" }),
  searchCode: async () => ({ hits: [] }),
  chat: async (_req, onEvent) => events.forEach(onEvent),
});

const D104 = "3TakfvuqXJzADJAiopzYwD";
const answer: AgentResponse = {
  route: "finding",
  answer: "D-104 is 762 mm wide [E1].",
  evidence: [],
  viewerCommands: [{ action: "highlight", globalIds: [D104] }],
  trace: [],
  usage: { llmCalls: 1, inputTokens: 1, outputTokens: 1 },
};

describe("chatStore.send", () => {
  beforeEach(() => {
    useChatStore.setState({ messages: [], busy: false });
    useViewerStore.setState({ runner: null, pending: { cmds: [], select: null }, selectedId: null });
  });

  it("adds the question and an answer that fills in step by step, then hands the 3D commands to the viewer", async () => {
    await useChatStore.getState().send(playing([{ type: "trace", step: { agent: "supervisor", summary: "route: finding · D-104" } }, { type: "result", result: answer }]), "  Why does D-104 fail?  ");
    const [q, a] = useChatStore.getState().messages;
    expect(q).toMatchObject({ role: "user", text: "Why does D-104 fail?" });
    expect(a).toMatchObject({ role: "assistant", status: "done", text: answer.answer, trace: [{ agent: "supervisor" }] });
    expect(useViewerStore.getState().pending.cmds).toEqual(answer.viewerCommands); // the 3D view is not open yet
    expect(useChatStore.getState().busy).toBe(false);
  });
  it("shows a usage limit as a notice, not as a failure", async () => {
    await useChatStore.getState().send(playing([{ type: "error", error: "This session has used its 20 messages for today.", notice: true }]), "hi");
    expect(useChatStore.getState().messages[1]).toMatchObject({ status: "error", notice: true });
  });
  it("marks an answer that never finished", async () => {
    await useChatStore.getState().send(playing([{ type: "trace", step: { agent: "supervisor", summary: "route" } }]), "hi");
    expect(useChatStore.getState().messages[1]).toMatchObject({ status: "error", text: "The answer stopped early." });
  });
  it("ignores an empty message", async () => {
    await useChatStore.getState().send(playing([]), "   ");
    expect(useChatStore.getState().messages).toEqual([]);
  });
});
