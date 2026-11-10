// A small valid report for tests (the same data as client/public/samples/office/report.json).
import type { Report } from "@shared/report";

export const FAKE_REPORT: Report = {
  "version": 1,
  "sampleId": "office",
  "generatedAt": "2026-11-09T00:00:00.000Z",
  "rulesBy": "hand-made sample data",
  "requirements": [
    {
      "id": "R-01",
      "title": "Door clear width at least 32 in",
      "citation": {
        "chunkId": "S022#051",
        "section": "1010.1.1.1",
        "page": 21,
        "sourceUrl": "https://www.nyc.gov/assets/buildings/codes-pdf/cons_codes_2022/2022BC_Chapter10_EgressWBwm.pdf",
        "quote": "shall provide a minimum clear width of 32 inches (812.2 mm)"
      }
    },
    {
      "id": "R-02",
      "title": "Ceiling height of occupiable spaces at least 7 ft 6 in",
      "citation": {
        "chunkId": "S024#033",
        "section": "1208.2",
        "page": 13,
        "sourceUrl": "https://www.nyc.gov/assets/buildings/codes-pdf/cons_codes_2022/2022BC_Chapter12_InteriorEnvironmentWBwm.pdf",
        "quote": "Occupiable spaces and corridors shall have a ceiling height of not less than 7 feet 6 inches (2286 mm)."
      }
    }
  ],
  "findings": [
    { "id": "F-01", "requirementId": "R-01", "globalId": "3TakfvuqXJzADJAiopzYwD", "element": "D-104", "ifcType": "IfcDoor", "storey": "Level 1", "quantity": "clearWidthMm", "observed": 762, "limit": 812.8, "op": ">=", "severity": "minor" },
    { "id": "F-02", "requirementId": "R-01", "globalId": "2zUezH1h1ID8IPokRC0Kwv", "element": "D-107", "ifcType": "IfcDoor", "storey": "Level 1", "quantity": "clearWidthMm", "observed": 711, "limit": 812.8, "op": ">=", "severity": "major" },
    { "id": "F-03", "requirementId": "R-02", "globalId": "3iUI1nRjDOgPm7JsX19MkA", "element": "105", "ifcType": "IfcSpace", "storey": "Level 1", "quantity": "ceilingHeightMm", "observed": 2210, "limit": 2286, "op": ">=", "severity": "minor" }
  ],
  "notEvaluated": 0,
  "trace": [
    { "agent": "researcher", "summary": "door_clear_width: \"minimum clear width of door openings\" → §1010.1.1.1", "ms": 900 },
    { "agent": "rule_author", "summary": "door_clear_width: >= 32 in from S022#051", "ms": 2400 },
    { "agent": "reviewer", "summary": "door_clear_width: accepted", "ms": 0 },
    { "agent": "checker", "summary": "2 rules on 48 elements → 3 findings", "ms": 2 }
  ]
};
