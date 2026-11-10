// Web Worker: parses the IFC file with web-ifc off the main thread and sends back the meshes.
import { IFCSPACE, IfcAPI, type FlatMesh } from "web-ifc";
import wasmUrl from "web-ifc/web-ifc.wasm?url";

/** The geometry of one element in world coordinates (metres, Y up), one part per colour. */
export interface MeshData {
  expressId: number;
  isSpace: boolean;
  parts: { color: [number, number, number, number]; positions: Float32Array; normals: Float32Array; indices: Uint32Array }[];
}

export type WorkerRequest = { id: number; kind: "open"; url: string };
export type WorkerResponse =
  | { id: number; kind: "meshes"; meshes: MeshData[] }
  | { id: number; kind: "opened"; ms: number }
  | { id: number; kind: "error"; message: string };

const api = new IfcAPI();
// web-ifc asks for its .wasm file by name; we answer with the URL Vite gave the file
const ready = api.Init((path) => (path.endsWith(".wasm") ? wasmUrl : path), true);
let openModel: number | null = null;

const post = (msg: WorkerResponse, transfer: Transferable[] = []) =>
  (self as unknown as { postMessage(m: unknown, t: Transferable[]): void }).postMessage(msg, transfer);

function toMeshData(modelID: number, mesh: FlatMesh, isSpace: boolean): MeshData {
  const byColor = new Map<string, { color: [number, number, number, number]; pos: number[]; nrm: number[]; idx: number[] }>();
  for (let g = 0; g < mesh.geometries.size(); g++) {
    const placed = mesh.geometries.get(g);
    const geom = api.GetGeometry(modelID, placed.geometryExpressID);
    const verts = api.GetVertexArray(geom.GetVertexData(), geom.GetVertexDataSize()); // x y z nx ny nz, repeated
    const index = api.GetIndexArray(geom.GetIndexData(), geom.GetIndexDataSize());
    const c = placed.color;
    const key = `${c.x},${c.y},${c.z},${c.w}`;
    let part = byColor.get(key);
    if (!part) byColor.set(key, (part = { color: [c.x, c.y, c.z, c.w], pos: [], nrm: [], idx: [] }));
    const m = placed.flatTransformation; // 4×4 matrix, column by column: moves the shape to its place
    const base = part.pos.length / 3;
    for (let i = 0; i < verts.length; i += 6) {
      const [x, y, z, nx, ny, nz] = [verts[i], verts[i + 1], verts[i + 2], verts[i + 3], verts[i + 4], verts[i + 5]];
      part.pos.push(m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]);
      const tx = m[0] * nx + m[4] * ny + m[8] * nz;
      const ty = m[1] * nx + m[5] * ny + m[9] * nz;
      const tz = m[2] * nx + m[6] * ny + m[10] * nz;
      const len = Math.hypot(tx, ty, tz) || 1;
      part.nrm.push(tx / len, ty / len, tz / len);
    }
    for (let i = 0; i < index.length; i++) part.idx.push(index[i] + base);
    geom.delete(); // free the WASM memory of this geometry
  }
  return {
    expressId: mesh.expressID,
    isSpace,
    parts: [...byColor.values()].map((p) => ({
      color: p.color,
      positions: new Float32Array(p.pos),
      normals: new Float32Array(p.nrm),
      indices: new Uint32Array(p.idx),
    })),
  };
}

async function open(id: number, url: string) {
  await ready;
  if (openModel !== null) api.CloseModel(openModel);
  const t0 = performance.now();
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  const modelID = api.OpenModel(new Uint8Array(await res.arrayBuffer()));
  openModel = modelID;

  const meshes: MeshData[] = [];
  api.StreamAllMeshes(modelID, (m) => meshes.push(toMeshData(modelID, m, false)));
  // spaces (rooms) are not streamed by default; ask for them separately
  api.StreamAllMeshesWithTypes(modelID, [IFCSPACE], (m) => meshes.push(toMeshData(modelID, m, true)));
  // transfer the buffers instead of copying them: the worker gives them away to the page
  post({ id, kind: "meshes", meshes }, meshes.flatMap((m) => m.parts.flatMap((p) => [p.positions.buffer, p.normals.buffer, p.indices.buffer])));
  post({ id, kind: "opened", ms: Math.round(performance.now() - t0) });
}

self.addEventListener("message", (e: MessageEvent<WorkerRequest>) => {
  const req = e.data;
  open(req.id, req.url).catch((err: unknown) => post({ id: req.id, kind: "error", message: err instanceof Error ? err.message : String(err) }));
});