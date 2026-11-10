// Reads an IFC file with web-ifc in Node (offline jobs only; the Worker never parses IFC).
import { readFileSync } from "node:fs";
import { IfcAPI } from "web-ifc";
import { extractModel, ifcSource, type ModelExtract } from "@shared/elementFacts";

export const SAMPLE_ID = "office";
export const SAMPLE_FILE = "client/public/samples/office/arch.ifc";

export async function readModel(path = SAMPLE_FILE): Promise<ModelExtract> {
  const api = new IfcAPI();
  await api.Init(); // loads the WASM file that ships inside the web-ifc package
  const modelID = api.OpenModel(readFileSync(path));
  try {
    return extractModel(ifcSource(api, modelID));
  } finally {
    api.Dispose(); // frees the WASM memory
  }
}
