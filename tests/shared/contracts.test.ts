// ChatRequestSchema by equivalence classes and boundary values: one test per class, two per boundary.
import { describe, expect, it } from "vitest";
import { ChatRequestSchema } from "@shared/contracts";

const ok = { sessionId: "s-12345678", message: "Why does D-104 fail?" };
const valid = (change: Record<string, unknown>) => ChatRequestSchema.safeParse({ ...ok, ...change }).success;

describe("ChatRequestSchema: sessionId", () => {
  it.each([
    { name: "7 characters (just below the minimum)", sessionId: "a".repeat(7), expected: false },
    { name: "8 characters (the minimum)", sessionId: "a".repeat(8), expected: true },
    { name: "64 characters (the maximum)", sessionId: "a".repeat(64), expected: true },
    { name: "65 characters (just above the maximum)", sessionId: "a".repeat(65), expected: false },
    { name: "letters, digits, _ and -", sessionId: "s-ABC_123-xyz", expected: true },
    { name: "a space", sessionId: "s 12345678", expected: false },
    { name: "a character outside the list (<)", sessionId: "s-<script>", expected: false },
    { name: "not a string", sessionId: 12345678, expected: false },
  ])("$name → valid: $expected", ({ sessionId, expected }) => {
    expect(valid({ sessionId })).toBe(expected);
  });
});

describe("ChatRequestSchema: message", () => {
  it.each([
    { name: "empty", message: "", expected: false },
    { name: "only spaces (empty after trim)", message: "   ", expected: false },
    { name: "1 character", message: "?", expected: true },
    { name: "1000 characters (the maximum)", message: "x".repeat(1000), expected: true },
    { name: "1001 characters", message: "x".repeat(1001), expected: false },
    { name: "1000 characters with spaces around (trimmed first)", message: `  ${"x".repeat(1000)}  `, expected: true },
    { name: "missing", message: undefined, expected: false },
  ])("$name → valid: $expected", ({ message, expected }) => {
    expect(valid({ message })).toBe(expected);
  });

  it("trims the message it passes on", () => {
    expect(ChatRequestSchema.parse({ ...ok, message: "  hi  " }).message).toBe("hi");
  });
});
