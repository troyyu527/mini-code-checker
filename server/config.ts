// Worker configuration: the only file that knows the names of the bindings and settings.
import type { SessionAgent } from "./services/sessionAgent";

/** Bindings and vars from wrangler.jsonc, plus .env locally / secrets when deployed. */
export interface Env {
  ALLOWED_ORIGINS: string;
  DB: D1Database;
  SESSION: DurableObjectNamespace<SessionAgent>;
  OLLAMA_BASE_URL?: string;
  OLLAMA_API_KEY?: string;
  OLLAMA_MODEL?: string;
  OLLAMA_EMBEDDING_MODEL?: string;
}

export const VERSION = "0.1.0";

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
/** The local embedding model (Ollama). Lesson 32 chooses between Ollama and Workers AI in one place. */
export function embeddingConfig(env: Pick<Env, "OLLAMA_BASE_URL" | "OLLAMA_API_KEY" | "OLLAMA_EMBEDDING_MODEL">) {
  return {
    baseUrl: env.OLLAMA_BASE_URL ?? "http://localhost:11434/v1",
    apiKey: env.OLLAMA_API_KEY ?? "ollama",
    model: env.OLLAMA_EMBEDDING_MODEL ?? "hf.co/CompendiumLabs/bge-small-en-v1.5-gguf:Q8_0",
  };
}
