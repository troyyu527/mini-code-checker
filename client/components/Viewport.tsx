// The 3D view. A placeholder for now (lesson 16 adds Three.js); it already shows the create → clean up life cycle.
import { useEffect } from "react";

export function Viewport({ modelUrl }: { modelUrl: string }) {
  useEffect(() => {
    console.log("viewer created for", modelUrl);
    return () => console.log("viewer disposed"); // cleanup: runs before the next effect and when the component goes away
  }, [modelUrl]);

  return <div className="grid h-full place-items-center text-muted">3D view of {modelUrl}</div>;
}