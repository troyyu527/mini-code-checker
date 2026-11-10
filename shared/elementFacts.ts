// ElementFacts: the measured facts of each building element, read from an IFC model.
// Pure: it reads the model only through the small IfcSource interface, so the browser (Web Worker) and Node (CLI)
// use the same code and can never disagree.

/** Lengths in mm ("…Mm"), areas in m² ("…M2"). */
export type Dims = Record<string, number>;

export interface ElementFacts {
  globalId: string;
  expressId: number;
  ifcType: string;
  name: string | null;
  longName: string | null;
  objectType: string | null;
  storey: string | null;
  dims: Dims;
}

export interface PropertyValue {
  globalId: string;
  set: string;
  name: string;
  value: string | number | boolean | null;
}

export interface ModelExtract {
  facts: ElementFacts[];
  properties: PropertyValue[];
  storeys: string[];
}

/** One IFC line as web-ifc returns it: attributes are `{ type, value }` objects, or arrays of them. */
export type IfcLine = { expressID: number; typeName: string } & Record<string, unknown>;

/** Read access to an open model. `typeName` is upper case, e.g. "IFCDOOR". */
export interface IfcSource {
  ids(typeName: string): number[];
  line(id: number): IfcLine;
}

/** The part of web-ifc's IfcAPI that ifcSource() needs (written here, so this file does not import web-ifc). */
export interface IfcApiLike {
  GetLineIDsWithType(modelID: number, type: number): { size(): number; get(i: number): number };
  GetLine(modelID: number, id: number): Record<string, unknown> & { expressID: number; type: number };
  GetTypeCodeFromName(name: string): number;
  GetNameFromTypeCode(code: number): string;
}

export function ifcSource(api: IfcApiLike, modelID: number): IfcSource {
  return {
    ids(typeName) {
      const v = api.GetLineIDsWithType(modelID, api.GetTypeCodeFromName(typeName));
      return Array.from({ length: v.size() }, (_, i) => v.get(i));
    },
    line(id) {
      const l = api.GetLine(modelID, id);
      return { ...l, typeName: api.GetNameFromTypeCode(l.type).toUpperCase() };
    },
  };
}

export const ELEMENT_TYPES = ["IfcDoor", "IfcWindow", "IfcWall", "IfcSlab", "IfcSpace"] as const;

// Small readers for web-ifc attributes: { value: 762 } → 762, missing → null.
const val = (a: unknown): unknown => (a && typeof a === "object" && "value" in a ? (a as { value: unknown }).value : (a ?? null));
const str = (a: unknown): string | null => {
  const v = val(a);
  return typeof v === "string" && v !== "" ? v : null;
};
const num = (a: unknown): number | null => {
  const v = val(a);
  return typeof v === "number" ? v : null;
};
const refs = (a: unknown): number[] => (Array.isArray(a) ? a.map(num).filter((x): x is number => x !== null) : []);
const plain = (a: unknown): string | number | boolean | null => {
  const v = val(a);
  if (v === "T" || v === "F") return v === "T"; // IFC booleans are the enum strings T and F
  return typeof v === "string" || typeof v === "number" || typeof v === "boolean" ? v : null;
};

export function extractModel(src: IfcSource): ModelExtract {
  const cache = new Map<number, IfcLine>();
  const line = (id: number) => {
    let l = cache.get(id);
    if (!l) cache.set(id, (l = src.line(id)));
    return l;
  };

  // 1. Relations: who contains whom, and which property sets belong to which element.
  const parent = new Map<number, number>();
  for (const id of src.ids("IFCRELCONTAINEDINSPATIALSTRUCTURE")) {
    const r = line(id);
    for (const el of refs(r.RelatedElements)) parent.set(el, num(r.RelatingStructure)!);
  }
  for (const id of src.ids("IFCRELAGGREGATES")) {
    const r = line(id);
    for (const el of refs(r.RelatedObjects)) parent.set(el, num(r.RelatingObject)!);
  }
  const psets = new Map<number, number[]>();
  for (const id of src.ids("IFCRELDEFINESBYPROPERTIES")) {
    const r = line(id);
    const def = num(r.RelatingPropertyDefinition)!;
    for (const el of refs(r.RelatedObjects)) psets.set(el, [...(psets.get(el) ?? []), def]);
  }

  // 2. Helpers that walk those relations.
  function storeyOf(id: number): string | null {
    for (let p = parent.get(id), hops = 0; p !== undefined && hops < 8; p = parent.get(p), hops++) {
      const l = line(p);
      if (l.typeName === "IFCBUILDINGSTOREY") return str(l.Name);
    }
    return null;
  }

  function propertiesOf(id: number): Omit<PropertyValue, "globalId">[] {
    const out: Omit<PropertyValue, "globalId">[] = [];
    for (const defId of psets.get(id) ?? []) {
      const def = line(defId);
      const set = str(def.Name) ?? "";
      if (def.typeName === "IFCPROPERTYSET") {
        for (const p of refs(def.HasProperties).map(line)) {
          if (p.typeName === "IFCPROPERTYSINGLEVALUE") out.push({ set, name: str(p.Name)!, value: plain(p.NominalValue) });
        }
      } else if (def.typeName === "IFCELEMENTQUANTITY") {
        for (const q of refs(def.Quantities).map(line)) {
          out.push({ set, name: str(q.Name)!, value: plain(q.LengthValue ?? q.AreaValue ?? q.VolumeValue) });
        }
      }
    }
    return out;
  }

  /** Size of the first extruded rectangle in the element's 3D body: x, y and the extrusion depth. */
  function boxOf(l: IfcLine): { x: number; y: number; depth: number } | null {
    const shape = num(l.Representation);
    if (shape === null) return null;
    for (const repId of refs(line(shape).Representations)) {
      const rep = line(repId);
      if (str(rep.RepresentationIdentifier) !== "Body") continue;
      for (const itemId of refs(rep.Items)) {
        const item = line(itemId);
        if (item.typeName !== "IFCEXTRUDEDAREASOLID") continue;
        const profile = line(num(item.SweptArea)!);
        if (profile.typeName !== "IFCRECTANGLEPROFILEDEF") continue;
        return { x: num(profile.XDim)!, y: num(profile.YDim)!, depth: num(item.Depth)! };
      }
    }
    return null;
  }

  function dimsOf(type: string, l: IfcLine, props: Map<string, unknown>): Dims {
    const d: Dims = {};
    const set = (key: string, v: unknown) => {
      if (typeof v === "number") d[key] = Math.round(v * 10) / 10;
    };
    const box = boxOf(l);
    const long = box && Math.max(box.x, box.y);
    const short = box && Math.min(box.x, box.y);
    if (type === "IfcDoor") {
      set("clearWidthMm", num(l.OverallWidth));
      set("heightMm", num(l.OverallHeight));
    } else if (type === "IfcWindow") {
      set("widthMm", num(l.OverallWidth));
      set("heightMm", num(l.OverallHeight));
    } else if (type === "IfcWall") {
      set("lengthMm", long);
      set("thicknessMm", short);
      set("heightMm", box?.depth);
    } else if (type === "IfcSlab") {
      set("thicknessMm", box?.depth);
    } else if (type === "IfcSpace") {
      set("ceilingHeightMm", props.get("FinishCeilingHeight") ?? box?.depth);
      set("floorAreaM2", props.get("NetFloorArea"));
    }
    return d;
  }

  // 3. One ElementFacts per element of the types we check.
  const facts: ElementFacts[] = [];
  const properties: PropertyValue[] = [];
  for (const type of ELEMENT_TYPES) {
    for (const id of src.ids(type.toUpperCase())) {
      const l = line(id);
      const globalId = str(l.GlobalId)!;
      const props = propertiesOf(id);
      facts.push({
        globalId,
        expressId: id,
        ifcType: type,
        name: str(l.Name),
        longName: str(l.LongName),
        objectType: str(l.ObjectType),
        storey: storeyOf(id),
        dims: dimsOf(type, l, new Map(props.map((p) => [p.name, p.value]))),
      });
      for (const p of props) properties.push({ globalId, ...p });
    }
  }
  const storeys = src.ids("IFCBUILDINGSTOREY").map((id) => str(line(id).Name) ?? "");
  return { facts, properties, storeys };
}
