// AI assistant: messages, the live agent steps, the cited answer and its evidence.
import { useState } from "react";
import type { Evidence } from "@shared/contracts";
import type { ApiClient } from "../services/apiClient";
import { useChatStore } from "../state/chatStore";

function EvidenceItem({ e }: { e: Evidence }) {
  if (e.kind === "code") {
    return (
      <li>
        <span className="font-mono">[{e.id}]</span> NYC BC §{e.section}
        {e.page !== null && ` p. ${e.page}`}: “{e.quote}”{" "}
        <a href={e.sourceUrl} target="_blank" rel="noreferrer" className="text-accent underline">
          PDF
        </a>
      </li>
    );
  }
  return (
    <li>
      <span className="font-mono">[{e.id}]</span> {e.findingId} {e.element}: {e.fact}
    </li>
  );
}

export function ChatPanel({ api }: { api: ApiClient }) {
  const { messages, busy, send } = useChatStore();
  const [text, setText] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault(); // a form would otherwise reload the page
    void send(api, text);
    setText("");
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-3 overflow-y-auto p-4" data-testid="messages">
        {messages.length === 0 && <p className="text-sm text-muted">Ask about the findings or the code, e.g. “Why does D-104 fail?”</p>}
        {messages.map((m) => (
          <div key={m.id} className={m.role === "user" ? "ml-8 rounded-lg bg-accent/20 p-2 text-sm" : "mr-8 rounded-lg border border-line p-2 text-sm"}>
            {m.role === "assistant" && m.trace.length > 0 && (
              <ol className="mb-1 text-xs text-muted">
                {m.trace.map((t, i) => (
                  <li key={i}>
                    <span className="font-mono">{t.agent}</span> {t.summary}
                    {t.ms !== undefined && ` (${t.ms} ms)`}
                  </li>
                ))}
              </ol>
            )}
            <p className={m.status === "error" ? (m.notice ? "text-minor" : "text-major") : ""}>
              {m.status === "pending" ? "Thinking…" : m.text}
            </p>
            {m.response && m.response.evidence.length > 0 && (
              <ul className="mt-1 space-y-1 text-xs text-muted">
                {m.response.evidence.map((e) => (
                  <EvidenceItem key={e.id} e={e} />
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
      <form onSubmit={submit} className="flex gap-2 border-t border-line p-3">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Ask the assistant…"
          className="flex-1 rounded-md border border-line bg-page px-3 py-1.5 text-sm"
          aria-label="Message"
        />
        <button disabled={busy || !text.trim()} className="rounded-md bg-accent px-3 py-1.5 text-sm disabled:opacity-50">
          Send
        </button>
      </form>
    </div>
  );
}
