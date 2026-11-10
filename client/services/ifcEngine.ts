// IFC engine: talks to the Web Worker and turns its messages into a promise.
import type { ModelExtract } from "@shared/elementFacts";
import type { MeshData, WorkerRequest, WorkerResponse } from "./ifcWorker";

export type { MeshData };

export interface IfcEngine {
  /** Loads a model; `onMeshes` gets the geometry before the promise resolves with the facts. */
  open(url: string, onMeshes: (meshes: MeshData[]) => void): Promise<{ model: ModelExtract; ms: number }>;
}

export function createIfcEngine(): IfcEngine {
  // Vite sees `new URL(..., import.meta.url)` inside `new Worker(...)` and bundles the worker file separately
  const worker = new Worker(new URL("./ifcWorker.ts", import.meta.url), { type: "module" });
  const waiting = new Map<number, { resolve(r: { model: ModelExtract; ms: number }): void; reject(e: Error): void; onMeshes(m: MeshData[]): void }>();
  let next = 1;

  worker.addEventListener("message", (e: MessageEvent<WorkerResponse>) => {
    const msg = e.data;
    const w = waiting.get(msg.id);
    if (!w) return;
    if (msg.kind === "meshes") return w.onMeshes(msg.meshes);
    waiting.delete(msg.id);
    if (msg.kind === "error") w.reject(new Error(msg.message));
    else w.resolve({ model: msg.model, ms: msg.ms });
  });

  return {
    open(url, onMeshes) {
      const id = next++;
      return new Promise((resolve, reject) => {
        waiting.set(id, { resolve, reject, onMeshes });
        worker.postMessage({ id, kind: "open", url } satisfies WorkerRequest);
      });
    },
  };
}
