// An in-memory SQLite (node:sqlite, built into Node 22+) shaped like a Durable Object's ctx.storage.sql.
import { DatabaseSync } from "node:sqlite";
import type { SqlRunner } from "../../server/services/budgetGuard";

export function memorySql(): SqlRunner {
  const db = new DatabaseSync(":memory:");
  return {
    exec(query, ...bindings) {
      const stmt = db.prepare(query);
      // a SELECT returns rows; other statements return nothing
      const rows = /^\s*select/i.test(query) ? (stmt.all(...(bindings as never[])) as Record<string, unknown>[]) : (stmt.run(...(bindings as never[])), []);
      return { toArray: () => rows };
    },
  };
}
