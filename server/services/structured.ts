// Structured output: ask the LLM for JSON, check it with zod, and on a bad reply ask once more with the error.
import type { z } from "zod";
import type { ChatMessage, LlmClient } from "./llm";

/** Takes the JSON object out of a reply that may be wrapped in ```json fences or have text around it. */
export function extractJson(content: string): unknown {
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("no JSON object in the reply");
  return JSON.parse(content.slice(start, end + 1));
}

export class StructuredOutputError extends Error {}

/** At most 1 + `retries` calls; each retry shows the model its own reply and what was wrong with it. */
export async function askJson<T>(llm: LlmClient, messages: ChatMessage[], schema: z.ZodType<T>, retries = 1): Promise<T> {
  const convo = [...messages];
  let lastError = "";
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await llm.chat(convo);
    try {
      const parsed = schema.safeParse(extractJson(res.content));
      if (parsed.success) return parsed.data;
      lastError = parsed.error.issues.slice(0, 5).map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; ");
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
    }
    convo.push(
      { role: "assistant", content: res.content },
      { role: "user", content: `That reply is not valid: ${lastError}. Reply again with the corrected JSON only.` },
    );
  }
  throw new StructuredOutputError(`no valid JSON after ${retries + 1} attempts: ${lastError}`);
}
