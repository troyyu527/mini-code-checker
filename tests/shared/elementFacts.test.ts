// extractModel with a fake IfcSource: a few hand-made IFC lines instead of a real file.
import { describe, expect, it } from "vitest";
import { extractModel, type IfcLine, type IfcSource } from "@shared/elementFacts";

const v = (value: unknown) => ({ value });

function fakeSource(lines: IfcLine[]): IfcSource {
  const byId = new Map(lines.map((l) => [l.expressID, l]));
  return {
    ids: (typeName) => lines.filter((l) => l.typeName === typeName).map((l) => l.expressID),
    line: (id) => byId.get(id)!,
  };
}

describe("extractModel", () => {
  const lines: IfcLine[] = [
    { expressID: 1, typeName: "IFCBUILDINGSTOREY", Name: v("Level 1") },
    { expressID: 2, typeName: "IFCDOOR", GlobalId: v("2".padEnd(22, "a")), Name: v("D-1"), OverallWidth: v(762), OverallHeight: v(2134) },
    { expressID: 3, typeName: "IFCDOOR", GlobalId: v("3".padEnd(22, "a")), Name: v("") }, // empty name, no sizes
    { expressID: 4, typeName: "IFCRELCONTAINEDINSPATIALSTRUCTURE", RelatingStructure: v(1), RelatedElements: [v(2)] },
  ];
  const model = extractModel(fakeSource(lines));

  it("reads the door sizes and the storey", () => {
    expect(model.facts[0]).toMatchObject({ ifcType: "IfcDoor", name: "D-1", storey: "Level 1", dims: { clearWidthMm: 762, heightMm: 2134 } });
  });
  it("turns an empty name into null and leaves missing sizes out", () => {
    expect(model.facts[1]).toMatchObject({ name: null, storey: null, dims: {} });
  });
  it("lists the storeys", () => {
    expect(model.storeys).toEqual(["Level 1"]);
  });
});
