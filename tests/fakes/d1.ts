// A small D1Database over Node's built-in SQLite (node:sqlite): prepare / bind / all / first / run, and batch as one
// transaction. Enough for testing the data functions without Wrangler.
import { DatabaseSync } from "node:sqlite";

type Bound = { sql: string; args: unknown[] };

export function memoryD1(db = new DatabaseSync(":memory:")) {
  const statement = (sql: string, args: unknown[] = []) => ({
    bound: { sql, args } as Bound,
    bind: (...a: unknown[]) => statement(sql, a),
    all: async () => ({ results: db.prepare(sql).all(...(args as never[])), success: true }),
    first: async () => db.prepare(sql).all(...(args as never[]))[0] ?? null,
    run: async () => (db.prepare(sql).run(...(args as never[])), { success: true }),
  });
  return {
    prepare: (sql: string) => statement(sql),
    async batch(stmts: { bound: Bound }[]) {
      db.exec("BEGIN");
      try {
        const out = stmts.map(({ bound }) => {
          const s = db.prepare(bound.sql);
          return s.columns().length ? { results: s.all(...(bound.args as never[])) } : (s.run(...(bound.args as never[])), { results: [] });
        });
        db.exec("COMMIT");
        return out;
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      }
    },
  } as unknown as D1Database;
}