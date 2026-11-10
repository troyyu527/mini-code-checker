// Contracts: the JSON that crosses the HTTP boundary between the browser and the Worker, and the SSE stream format.
import { z } from "zod";
import type { ViewerCommand } from "./viewerCommand";

export interface HealthResponse {
  ok: boolean;
  version: string;
}

export const ChatRequestSchema = z.object({
  sessionId: z.string().min(8).max(64).regex(/^[A-Za-z0-9_-]+$/),
  message: z.string().trim().min(1).max(1000),
});
export type ChatRequest = z.infer<typeof ChatRequestSchema>;

/** One agent step, shown while the run goes on. */
export interface TraceStep {
  agent: string;
  summary: string;
  ms?: number;
}

/** What the answer is based on; the answer points to it as [E1], [E2] … */
export type Evidence =
  | { id: string; kind: "code"; chunkId: string; section: string; page: number | null; sourceUrl: string; quote: string }
  | { id: string; kind: "finding"; findingId: string; globalId: string; element: string; fact: string };

export const ROUTES = ["question", "finding", "ask_user"] as const;
export type Route = (typeof ROUTES)[number];

export interface AgentResponse {
  route: Route;
  answer: string;
  evidence: Evidence[];
  viewerCommands: ViewerCommand[];
  trace: TraceStep[];
  usage: { llmCalls: number; inputTokens: number; outputTokens: number };
}

/** Server-sent events of a chat run. `notice` marks a usage limit, not a failure. */
export type StreamEvent =
  | { type: "trace"; step: TraceStep }
  | { type: "result"; result: AgentResponse }
  | { type: "error"; error: string; notice?: boolean };

/** One SSE event: "data: <json>" and an empty line. */
export const encodeEvent = (e: StreamEvent): string => `data: ${JSON.stringify(e)}\n\n`;

/** Splits received text into complete events and the unfinished rest (a network chunk can end mid-event). */
export function decodeEvents(buffer: string): { events: StreamEvent[]; rest: string } {
  const parts = buffer.split("\n\n");
  const rest = parts.pop() ?? "";
  const events = parts.flatMap((p) => {
    const data = p
      .split("\n")
      .filter((l) => l.startsWith("data: "))
      .map((l) => l.slice(6))
      .join("\n");
    return data ? [JSON.parse(data) as StreamEvent] : [];
  });
  return { events, rest };
}
