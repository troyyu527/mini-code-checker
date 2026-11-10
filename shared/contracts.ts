// Contracts: the JSON that crosses the HTTP boundary between the browser and the Worker.
import { z } from "zod";

export interface HealthResponse {
  ok: boolean;
  version: string;
}

export const ChatRequestSchema = z.object({
  sessionId: z.string().min(8).max(64).regex(/^[A-Za-z0-9_-]+$/),
  message: z.string().trim().min(1).max(1000),
});
export type ChatRequest = z.infer<typeof ChatRequestSchema>;
/** What an answer is based on; the answer points to it as [E1], [E2] … */
export type Evidence =
  | { id: string; kind: "code"; chunkId: string; section: string; page: number | null; sourceUrl: string; quote: string }
  | { id: string; kind: "finding"; findingId: string; globalId: string; element: string; fact: string };
