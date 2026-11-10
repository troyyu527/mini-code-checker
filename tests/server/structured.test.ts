import { describe, expect, it } from "vitest";
import { z } from "zod";
import { askJson, extractJson, StructuredOutputError } from "../../server/services/structured";
import { scriptedLlm } from "../fakes/llm";

const schema = z.object({ n: z.number() });

describe("extractJson", () => {
  it("takes the object out of a ```json fence or surrounding text", () => {
    expect(extractJson('Sure! ```json\n{"n": 1}\n``` Hope this helps.')).toEqual({ n: 1 });
  });
  it("fails clearly when there is no object", () => {
    expect(() => extractJson("I cannot do that.")).toThrow("no JSON object in the reply");
  });
});

describe("askJson", () => {
  it("accepts JSON inside a ```json fence", async () => {
    expect(await askJson(scriptedLlm(['```json\n{"n": 1}\n```']), [], schema)).toEqual({ n: 1 });
  });
  it("retries once with the error, then succeeds", async () => {
    const llm = scriptedLlm(['{"n": "one"}', '{"n": 1}']);
    expect(await askJson(llm, [], schema)).toEqual({ n: 1 });
    expect(llm.calls[1].at(-1)!.content).toMatch(/not valid: n:/);
    expect(llm.calls[1].at(-2)).toEqual({ role: "assistant", content: '{"n": "one"}' });
  });
  it("gives up after the retries", async () => {
    await expect(askJson(scriptedLlm(["no", "still no"]), [], schema)).rejects.toBeInstanceOf(StructuredOutputError);
  });
});