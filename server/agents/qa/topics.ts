// Planner: which checks to run. Plain code here (the real project asks an LLM to plan from the model summary).
import type { ElementFacts } from "@shared/elementFacts";

export interface Topic {
  id: string;
  title: string;
  appliesTo: string;
  quantity: string;
  /** What the Researcher searches for. */
  query: string;
  /** A plausible range for the limit in the quantity's unit; a limit outside it is surely a misread. */
  range: [number, number];
}

export const TOPICS: Topic[] = [
  { id: "door_clear_width", title: "Door clear width", appliesTo: "IfcDoor", quantity: "clearWidthMm", query: "minimum clear width of door openings", range: [500, 1500] },
  { id: "door_height", title: "Door height", appliesTo: "IfcDoor", quantity: "heightMm", query: "minimum height of means of egress doors", range: [1800, 2600] },
  { id: "ceiling_height", title: "Ceiling height", appliesTo: "IfcSpace", quantity: "ceilingHeightMm", query: "minimum ceiling height of occupiable spaces and corridors", range: [1800, 3500] },
];

/** Only the topics whose element type is in the model. */
export function planTopics(facts: ElementFacts[]): Topic[] {
  const types = new Set(facts.map((f) => f.ifcType));
  return TOPICS.filter((t) => types.has(t.appliesTo));
}
