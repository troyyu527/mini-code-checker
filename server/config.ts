// Worker configuration: the only file that knows the names of the bindings and settings.

/** Bindings and vars from wrangler.jsonc, plus .env locally / secrets when deployed. */
export interface Env {
  ALLOWED_ORIGINS: string;
  DB: D1Database;
}

export const VERSION = "0.1.0";

export interface Config {
  version: string;
  allowedOrigins: string[];
}

export function readConfig(env: Pick<Env, "ALLOWED_ORIGINS">): Config {
  return {
    version: VERSION,
    allowedOrigins: env.ALLOWED_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean),
  };
}