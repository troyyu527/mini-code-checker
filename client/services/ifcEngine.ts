// IFC engine: talks to the Web Worker and turns its messages into a promise.
import type { MeshData, WorkerRequest, WorkerResponse } from "./ifcWorker";

export type { MeshData };

export interface IfcEngine {
  /** Loads a model; `onMeshes` gets the geometry before the promise resolves. */
  open(url: string, onMeshes: (meshes: MeshData[]) => void): Promise<{ ms: number; ids: [number, string][] }>;
}

export function createIfcEngine(): IfcEngine {
  // Vite sees `new URL(..., import.meta.url)` inside `new Worker(...)` and bundles the worker file separately
  const worker = new Worker(new URL("./ifcWorker.ts", import.meta.url), { type: "module" });
  const waiting = new Map<number, { resolve(r: { ms: number; ids: [number, string][] }): void; reject(e: Error): void; onMeshes(m: MeshData[]): void }>();
  let next = 1;

  worker.addEventListener("message", (e: MessageEvent<WorkerResponse>) => {
    const msg = e.data;
    const w = waiting.get(msg.id);
    if (!w) return;
    if (msg.kind === "meshes") return w.onMeshes(msg.meshes);
    waiting.delete(msg.id);
    if (msg.kind === "error") w.reject(new Error(msg.message));
    else w.resolve({ ms: msg.ms, ids: msg.ids });
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