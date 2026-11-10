// Bindings for the offline jobs: the same local D1 that `wrangler dev` uses (.wrangler/state).
import { getPlatformProxy } from "wrangler";
import type { Env } from "../config";

export async function openBindings(): Promise<{ env: Env; dispose: () => Promise<void> }> {
  // getPlatformProxy reads wrangler.jsonc (and .env), and gives us the bindings as they are inside the Worker
  const { env, dispose } = await getPlatformProxy<Env>();
  return { env, dispose };
}