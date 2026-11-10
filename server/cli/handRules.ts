// Two rules written by hand from the code text. Lesson 30 lets AI agents write rules like these.
import { makeRequirement, type Requirement } from "@shared/requirement";

const EGRESS_PDF = "https://www.nyc.gov/assets/buildings/codes-pdf/cons_codes_2022/2022BC_Chapter10_EgressWBwm.pdf";
const INTERIOR_PDF = "https://www.nyc.gov/assets/buildings/codes-pdf/cons_codes_2022/2022BC_Chapter12_InteriorEnvironmentWBwm.pdf";

export const HAND_RULES: Requirement[] = [
  makeRequirement({
    id: "R-01",
    title: "Door clear width at least 32 in",
    appliesTo: "IfcDoor",
    where: [],
    quantity: "clearWidthMm",
    op: ">=",
    value: 32,
    unit: "in",
    citation: {
      chunkId: "S022#051",
      section: "1010.1.1.1",
      page: 21,
      sourceUrl: EGRESS_PDF,
      // copied word for word, including the code's own typo "812.2 mm" (32 in is 812.8 mm)
      quote: "shall provide a minimum clear width of 32 inches (812.2 mm)",
    },
  }),
  makeRequirement({
    id: "R-02",
    title: "Ceiling height of occupiable spaces at least 7 ft 6 in",
    appliesTo: "IfcSpace",
    // restrooms and storage rooms have a lower limit (7 ft) in the same section
    where: [{ field: "objectType", op: "not_in", values: ["Restroom", "Storage"] }],
    quantity: "ceilingHeightMm",
    op: ">=",
    value: 90,
    unit: "in",
    citation: {
      chunkId: "S024#033",
      section: "1208.2",
      page: 13,
      sourceUrl: INTERIOR_PDF,
      quote: "Occupiable spaces and corridors shall have a ceiling height of not less than 7 feet 6 inches (2286 mm).",
    },
  }),
];
