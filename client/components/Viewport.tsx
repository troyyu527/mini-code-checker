// The 3D view: creates the viewer, loads the model through the IFC engine, shows the load status.
// Loaded with React.lazy, so Three.js and web-ifc are downloaded only when this component is shown.
import { useEffect, useRef, useState } from "react";
import { createIfcEngine, type IfcEngine } from "../services/ifcEngine";
import { createViewer } from "../services/viewer";

let engine: IfcEngine | null = null; // one Web Worker for the whole page

export function Viewport({ modelUrl }: { modelUrl: string }) {
  const host = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState("Loading model…");

  useEffect(() => {
    engine ??= createIfcEngine();
    const viewer = createViewer(host.current!);
    let live = true;
    engine
      .open(modelUrl, (meshes) => live && viewer.add(meshes))
      .then(({ ms }) => live && setStatus(`Model loaded in ${ms} ms`))
      .catch((e: unknown) => live && setStatus(`Error: ${e instanceof Error ? e.message : String(e)}`));
    return () => {
      live = false;
      viewer.dispose();
    };
  }, [modelUrl]);

  return (
    <div className="relative h-full w-full">
      <div ref={host} className="absolute inset-0" data-testid="viewport" />
      <span className="absolute left-2 top-2 rounded bg-panel/80 px-2 py-1 text-xs" data-testid="viewer-status">
        {status}
      </span>
    </div>
  );
}