// Fake data with the same shape as the real report.json, so the UI can be built before the data exists.
import type { Report } from "@shared/report";

export const FAKE_REPORT: Report = {
  version: 1,
  sampleId: "office",
  generatedAt: "2026-11-09T00:00:00.000Z",
  rulesBy: "fake data",
  requirements: [
    { id: "R-01", title: "Door clear width at least 32 in", citation: { section: "1010.1.1.1", quote: "shall provide a minimum clear width of 32 inches (812.2 mm)" } },
    { id: "R-02", title: "Ceiling height at least 7 ft 6 in", citation: { section: "1208.2", quote: "Occupiable spaces and corridors shall have a ceiling height of not less than 7 feet 6 inches (2286 mm)." } },
  ],
  findings: [
    { id: "F-01", requirementId: "R-01", globalId: "3TakfvuqXJzADJAiopzYwD", element: "D-104", ifcType: "IfcDoor", storey: "Level 1", quantity: "clearWidthMm", observed: 762, limit: 812.8, op: ">=", severity: "minor" },
    { id: "F-02", requirementId: "R-01", globalId: "0LlP5Jd$j3GOaq0a6NUSiP", element: "D-107", ifcType: "IfcDoor", storey: "Level 1", quantity: "clearWidthMm", observed: 711, limit: 812.8, op: ">=", severity: "major" },
    { id: "F-03", requirementId: "R-02", globalId: "2yvKoNKZz3ehGWgJlHeLvh", element: "105", ifcType: "IfcSpace", storey: "Level 1", quantity: "ceilingHeightMm", observed: 2210, limit: 2286, op: ">=", severity: "minor" },
  ],
  notEvaluated: 0,
  trace: [{ agent: "checker", summary: "2 rules on 48 elements", ms: 1 }],
};