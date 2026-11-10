// BudgetGuard Durable Object: one for the whole site. Counts LLM tokens per day and messages per session, so a
// public demo cannot run up a bill or use up the free daily AI allowance.
import { DurableObject } from "cloudflare:workers";
import { type Env, type Limits, readLimits } from "../config";

/** The part of SQLite that the ledger needs: the Durable Object's ctx.storage.sql, or node:sqlite in tests. */
export interface SqlRunner {
  exec(query: string, ...bindings: unknown[]): { toArray(): Record<string, unknown>[] };
}

export type Gate = { ok: true } | { ok: false; notice: string };

const utcDay = () => new Date().toISOString().slice(0, 10);

export const BUDGET_NOTICE = "The free daily AI budget is used up. The report and the 3D model keep working; the assistant is back tomorrow (00:00 UTC).";

/** The counting logic, separate from the Durable Object so tests can run it on any SQLite. */
export class BudgetLedger {
  constructor(
    private readonly sql: SqlRunner,
    private readonly limits: Limits,
    private readonly today: () => string = utcDay,
  ) {
    sql.exec("CREATE TABLE IF NOT EXISTS budget (day TEXT NOT NULL, key TEXT NOT NULL, value REAL NOT NULL, PRIMARY KEY (day, key))");
  }

  private value(key: string): number {
    const [row] = this.sql.exec("SELECT value FROM budget WHERE day = ? AND key = ?", this.today(), key).toArray();
    return Number(row?.value ?? 0);
  }

  private add(key: string, amount: number): void {
    const day = this.today();
    this.sql.exec(
      "INSERT INTO budget (day, key, value) VALUES (?, ?, ?) ON CONFLICT (day, key) DO UPDATE SET value = value + excluded.value",
      day,
      key,
      amount,
    );
    this.sql.exec("DELETE FROM budget WHERE day < ?", day); // old days are not needed any more
  }

  /** May this session send one more message? If yes, the message is counted. */
  reserve(sessionId: string): Gate {
    if (this.value("tokens") >= this.limits.dailyTokens) return { ok: false, notice: BUDGET_NOTICE };
    const key = `chat:${sessionId}`;
    if (this.value(key) >= this.limits.sessionMessages) {
      return { ok: false, notice: `This session has used its ${this.limits.sessionMessages} messages for today. The report keeps working.` };
    }
    this.add(key, 1);
    return { ok: true };
  }

  /** Adds the tokens a finished answer used. */
  record(tokens: number): void {
    if (tokens > 0) this.add("tokens", tokens);
  }
}

export class BudgetGuard extends DurableObject<Env> {
  private readonly ledger: BudgetLedger;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.ledger = new BudgetLedger(ctx.storage.sql, readLimits(env));
  }

  reserve(sessionId: string): Gate {
    return this.ledger.reserve(sessionId);
  }

  record(tokens: number): void {
    this.ledger.record(tokens);
  }
}
