// Worker configuration: the only file that knows the names of the bindings and settings.
import type { BudgetGuard } from "./services/budgetGuard";
import type { SessionAgent } from "./services/sessionAgent";

/** Bindings and vars from wrangler.jsonc, plus .env locally / secrets when deployed. */
export interface Env {
  ALLOWED_ORIGINS: string;
  DB: D1Database;
  SESSION: DurableObjectNamespace<SessionAgent>;
  BUDGET: DurableObjectNamespace<BudgetGuard>;
  /** "ollama" (local) or "workers-ai" (deployed). */
  AI_PROVIDER: string;
  AI?: Ai;
  CODE_INDEX?: Vectorize;
  OLLAMA_BASE_URL?: string;
  OLLAMA_API_KEY?: string;
  OLLAMA_MODEL?: string;
  OLLAMA_EMBEDDING_MODEL?: string;
  DAILY_TOKEN_LIMIT?: string;
  SESSION_MESSAGE_LIMIT?: string;
  VISITOR_MESSAGE_LIMIT?: string;
}

export const VERSION = "0.2.0";

export interface Config {
  version: string;
  allowedOrigins: string[];
}

export function readConfig(env: Pick<Env, "ALLOWED_ORIGINS">): Config {
  return {
    version: VERSION,
    allowedOrigins: env.ALLOWED_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean),
  };
}

export interface Limits {
  /** LLM tokens (input + output) per day for all visitors together. */
  dailyTokens: number;
  /** Chat messages per session per day. */
  sessionMessages: number;
  /** Chat messages per visitor (IP address) per day, over all their sessions. */
  visitorMessages: number;
}

export const LIMITS: Limits = { dailyTokens: 200_000, sessionMessages: 20, visitorMessages: 60 };

export function readLimits(env: Pick<Env, "DAILY_TOKEN_LIMIT" | "SESSION_MESSAGE_LIMIT" | "VISITOR_MESSAGE_LIMIT">): Limits {
  const n = (v: string | undefined, d: number) => (v && Number.isFinite(Number(v)) ? Number(v) : d);
  return {
    dailyTokens: n(env.DAILY_TOKEN_LIMIT, LIMITS.dailyTokens),
    sessionMessages: n(env.SESSION_MESSAGE_LIMIT, LIMITS.sessionMessages),
    visitorMessages: n(env.VISITOR_MESSAGE_LIMIT, LIMITS.visitorMessages),
  };
}
