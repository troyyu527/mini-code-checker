import { describe, expect, it } from "vitest";
import { decodeEvents, encodeEvent, type StreamEvent } from "@shared/contracts";
import { eventStream } from "../../server/services/sessionAgent";

const readAll = async (stream: ReadableStream<Uint8Array>) => new Response(stream).text();

describe("SSE", () => {
  it("encodes one event as 'data: <json>' and an empty line", () => {
    expect(encodeEvent({ type: "error", error: "x" })).toBe('data: {"type":"error","error":"x"}\n\n');
  });
  it("keeps an event that is cut in the middle for the next chunk", () => {
    const text = encodeEvent({ type: "trace", step: { agent: "a", summary: "one" } }) + encodeEvent({ type: "trace", step: { agent: "b", summary: "two" } });
    const first = decodeEvents(text.slice(0, 50));
    const second = decodeEvents(first.rest + text.slice(50));
    expect([...first.events, ...second.events]).toHaveLength(2);
    expect(second.rest).toBe("");
  });
});

describe("eventStream", () => {
  it("sends the events in order and closes the stream", async () => {
    const stream = eventStream(async (send) => {
      send({ type: "trace", step: { agent: "supervisor", summary: "route" } });
      send({ type: "error", error: "done", notice: true });
    });
    const { events } = decodeEvents(await readAll(stream));
    expect(events.map((e: StreamEvent) => e.type)).toEqual(["trace", "error"]);
  });
  it("turns a crash into an error event (no internals)", async () => {
    const stream = eventStream(async () => {
      throw new Error("D1 exploded at line 42");
    });
    const { events } = decodeEvents(await readAll(stream));
    expect(events).toEqual([{ type: "error", error: "The assistant failed. Please try again." }]);
  });
});