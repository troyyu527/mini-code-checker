// The 3D view. For now it only loads the model in the Web Worker and reports what came back (lesson 16 draws it).
import { useEffect, useState } from "react";
import { createIfcEngine, type IfcEngine } from "../services/ifcEngine";

let engine: IfcEngine | null = null; // one Web Worker for the whole page

export function Viewport({ modelUrl }: { modelUrl: string }) {
  const [status, setStatus] = useState("Loading model…");

  useEffect(() => {
    engine ??= createIfcEngine();
    let live = true;
    let meshes = 0;
    let triangles = 0;
    engine
      .open(modelUrl, (batch) => {
        meshes += batch.length;
        for (const m of batch) for (const p of m.parts) triangles += p.indices.length / 3;
      })
      .then(({ ms }) => live && setStatus(`${meshes} meshes, ${triangles} triangles, parsed in ${ms} ms`))
      .catch((e: unknown) => live && setStatus(`Error: ${e instanceof Error ? e.message : String(e)}`));
    return () => {
      live = false;
    };
  }, [modelUrl]);

  return (
    <div className="grid h-full place-items-center text-muted" data-testid="viewer-status">
      {status}
    </div>
  );
}