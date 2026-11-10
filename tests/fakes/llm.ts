// Scripted LLM: answers with the queued replies in order and records every call. No network, no cost.
import type { ChatMessage, LlmClient } from "../../server/services/llm";

export function scriptedLlm(replies: string[]): LlmClient & { calls: ChatMessage[][] } {
  const calls: ChatMessage[][] = [];
  return {
    calls,
    async chat(messages) {
      calls.push(messages);
      const content = replies.shift();
      if (content === undefined) throw new Error("scriptedLlm: no more replies");
      return { content, usage: { inputTokens: 10, outputTokens: 5 } };
    },
  };
}
