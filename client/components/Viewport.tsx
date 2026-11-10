// The 3D view: creates the viewer, loads the model through the IFC engine, and connects both to the stores.
// Loaded with React.lazy, so Three.js and web-ifc are downloaded only when this component is shown.
import { useEffect, useRef } from "react";
import { createIfcEngine, type IfcEngine } from "../services/ifcEngine";
import { createViewer } from "../services/viewer";
import { issuesCommand, useReportStore } from "../state/reportStore";
import { useViewerStore } from "../state/viewerStore";

let engine: IfcEngine | null = null; // one Web Worker for the whole page

export function Viewport({ modelUrl }: { modelUrl: string }) {
  const host = useRef<HTMLDivElement>(null);
  const status = useViewerStore((s) => s.status);
  const runner = useViewerStore((s) => s.runner);
  const report = useReportStore((s) => s.report);

  useEffect(() => {
    engine ??= createIfcEngine();
    const viewer = createViewer(host.current!);
    const store = useViewerStore.getState();
    viewer.onPick((gid) => useViewerStore.getState().select(gid));
    let live = true; // false after cleanup: answers that arrive late are ignored
    store.setStatus({ state: "loading" });
    engine
      .open(modelUrl, (meshes) => live && viewer.add(meshes))
      .then(({ ms, ids }) => {
        if (!live) return;
        viewer.setIds(ids);
        store.setStatus({ state: "ready", ms });
        store.setRunner((cmd) => viewer.run(cmd));
      })
      .catch((e: unknown) => live && store.setStatus({ state: "error", message: e instanceof Error ? e.message : String(e) }));
    return () => {
      live = false;
      store.setRunner(null);
      viewer.dispose();
    };
  }, [modelUrl]);

  // colour the elements with findings once both the report and the viewer are ready
  useEffect(() => {
    if (report && runner) runner(issuesCommand(report));
  }, [report, runner]);

  return (
    <div className="relative h-full w-full">
      <div ref={host} className="absolute inset-0" data-testid="viewport" />
      <div className="absolute left-2 top-2 flex gap-2 text-xs">
        <span className="rounded bg-panel/80 px-2 py-1" data-testid="viewer-status">
          {status.state === "ready" ? `Model loaded in ${status.ms} ms` : status.state === "error" ? `Error: ${status.message}` : "Loading model…"}
        </span>
        <button onClick={() => useViewerStore.getState().run({ action: "reset" })} className="rounded bg-panel/80 px-2 py-1">
          Reset view
        </button>
      </div>
    </div>
  );
}
