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