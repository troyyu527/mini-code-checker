// Stand-in for the "cloudflare:workers" module in Node tests: a DurableObject base class that keeps ctx and env.
export class DurableObject<Env = unknown> {
  constructor(
    protected readonly ctx: unknown,
    protected readonly env: Env,
  ) {}
}
