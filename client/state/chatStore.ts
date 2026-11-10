// Chat state: the session id, the messages, and sending a message with the streamed agent steps.
import { create } from "zustand";
import type { AgentResponse, TraceStep } from "@shared/contracts";
import type { ApiClient } from "../services/apiClient";
import { useViewerStore } from "./viewerStore";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  status: "pending" | "done" | "error";
  trace: TraceStep[];
  response?: AgentResponse;
  /** A usage limit message, not a failure. */
  notice?: boolean;
}

interface ChatState {
  sessionId: string;
  messages: ChatMessage[];
  busy: boolean;
  send(api: ApiClient, text: string): Promise<void>;
}

/** One id per browser tab; it survives a reload when sessionStorage works. */
function sessionId(): string {
  const fresh = `s-${crypto.randomUUID()}`;
  try {
    const known = sessionStorage.getItem("mcc-session");
    if (known) return known;
    sessionStorage.setItem("mcc-session", fresh);
  } catch {
    // storage blocked (private mode): a new id per page load is fine
  }
  return fresh;
}

let next = 0;
const newId = () => `m${++next}`;

export const useChatStore = create<ChatState>((set, get) => {
  const update = (id: string, change: (m: ChatMessage) => Partial<ChatMessage>) =>
    set((s) => ({ messages: s.messages.map((m) => (m.id === id ? { ...m, ...change(m) } : m)) }));

  return {
    sessionId: sessionId(),
    messages: [],
    busy: false,
    async send(api, text) {
      const message = text.trim();
      if (!message || get().busy) return;
      const answerId = newId();
      set((s) => ({
        busy: true,
        messages: [
          ...s.messages,
          { id: newId(), role: "user", text: message, status: "done", trace: [] },
          { id: answerId, role: "assistant", text: "", status: "pending", trace: [] },
        ],
      }));
      try {
        await api.chat({ sessionId: get().sessionId, message }, (e) => {
          if (e.type === "trace") update(answerId, (m) => ({ trace: [...m.trace, e.step] }));
          else if (e.type === "error") update(answerId, () => ({ status: "error", text: e.error, notice: e.notice }));
          else {
            update(answerId, () => ({ status: "done", text: e.result.answer, response: e.result }));
            useViewerStore.getState().runWhenReady(e.result.viewerCommands);
          }
        });
        // the stream ended without a result or an error event
        update(answerId, (m) => (m.status === "pending" ? { status: "error", text: "The answer stopped early." } : {}));
      } catch (e) {
        update(answerId, () => ({ status: "error", text: e instanceof Error ? e.message : String(e) }));
      } finally {
        set({ busy: false });
      }
    },
  };
});
