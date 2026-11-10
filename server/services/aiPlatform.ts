// Picks the AI services: Ollama + the D1 vector table locally, Workers AI + Vectorize when deployed.
import type { Env } from "../config";
import { createOpenAiCompatClient, createOpenAiCompatEmbedder, createWorkersAiClient, createWorkersAiEmbedder, type Embedder, type LlmClient } from "./llm";
import { createD1VectorIndex, createVectorizeIndex, type VectorIndex } from "./vectorIndex";

export interface AiPlatform {
  provider: "ollama" | "workers-ai";
  model: string;
  llm: LlmClient;
  embedder: Embedder;
  index: VectorIndex;
}

export const WORKERS_AI_MODEL = "@cf/qwen/qwen3-30b-a3b-fp8";

export function aiPlatform(env: Env): AiPlatform {
  if (env.AI_PROVIDER === "workers-ai") {
    if (!env.AI || !env.CODE_INDEX) throw new Error("AI_PROVIDER=workers-ai needs the AI and CODE_INDEX bindings");
    return {
      provider: "workers-ai",
      model: WORKERS_AI_MODEL,
      llm: createWorkersAiClient(env.AI, WORKERS_AI_MODEL),
      embedder: createWorkersAiEmbedder(env.AI),
      index: createVectorizeIndex(env.CODE_INDEX),
    };
  }
  const need = (name: keyof Env) => {
    const v = env[name];
    if (typeof v !== "string" || !v) throw new Error(`${name} is not set (copy .env.example to .env)`);
    return v;
  };
  const conn = { baseUrl: need("OLLAMA_BASE_URL"), apiKey: env.OLLAMA_API_KEY ?? "ollama" };
  return {
    provider: "ollama",
    model: need("OLLAMA_MODEL"),
    llm: createOpenAiCompatClient({ ...conn, model: need("OLLAMA_MODEL") }),
    embedder: createOpenAiCompatEmbedder({ ...conn, model: need("OLLAMA_EMBEDDING_MODEL") }),
    index: createD1VectorIndex(env.DB),
  };
}
