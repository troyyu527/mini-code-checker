import type { HealthResponse } from "@shared/contracts";
import type { Config } from "../config";

export function health(config: Config): Response {
  return Response.json({ ok: true, version: config.version } satisfies HealthResponse);
}
