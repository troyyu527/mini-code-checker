// Bindings for the offline jobs: the same local D1 that `wrangler dev` uses (.wrangler/state),
// or with --remote the deployed D1, Vectorize index and Workers AI (server/cli/wrangler.remote.jsonc).
import { getPlatformProxy } from "wrangler";
import type { Env } from "../config";

export async function openBindings(args: string[] = process.argv): Promise<{ env: Env; remote: boolean; dispose: () => Promise<void> }> {
  const remote = args.includes("--remote");
  // getPlatformProxy reads a wrangler config (and .env), and gives us the bindings as they are inside the Worker
  const { env, dispose } = remote
    ? await getPlatformProxy<Env>({ configPath: "server/cli/wrangler.remote.jsonc" })
    : await getPlatformProxy<Env>();
  // .env says AI_PROVIDER=ollama; the remote bindings are Workers AI and Vectorize
  return { env: remote ? { ...env, AI_PROVIDER: "workers-ai" } : env, remote, dispose };
}
