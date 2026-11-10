// Requirement: one code rule written as data, so plain code (not an AI) can check it on every element.
import { z } from "zod";
import { toFactUnit, UNITS } from "./units";

export const OPERATORS = [">=", "<=", ">", "<"] as const;
export type Operator = (typeof OPERATORS)[number];

export const ConditionSchema = z.object({
  field: z.enum(["name", "longName", "objectType", "storey"]),
  op: z.enum(["in", "not_in"]),
  /** Compared without caring about upper or lower case. */
  values: z.array(z.string().min(1).max(80)).min(1).max(20),
});
export type Condition = z.infer<typeof ConditionSchema>;

export const CitationSchema = z.object({
  chunkId: z.string(),
  /** The provision, e.g. "1010.1.1.1". */
  section: z.string(),
  page: z.number().nullable(),
  sourceUrl: z.string(),
  /** Copied word for word from the code text. */
  quote: z.string().min(1).max(400),
});
export type Citation = z.infer<typeof CitationSchema>;

export const RequirementSchema = z
  .object({
    id: z.string().regex(/^R-\d{2}$/),
    title: z.string().min(3).max(160),
    appliesTo: z.string().regex(/^Ifc[A-Za-z]+$/),
    where: z.array(ConditionSchema).max(4),
    /** A key of ElementFacts.dims, e.g. "clearWidthMm". */
    quantity: z.string().regex(/^[a-z][a-zA-Z0-9]*(Mm|M2)$/),
    op: z.enum(OPERATORS),
    /** The limit as the code writes it, e.g. 32 … */
    value: z.number().positive(),
    /** … in this unit, e.g. "in". */
    unit: z.enum(UNITS),
    /** … and converted to the quantity's unit (mm or m²). */
    limit: z.number().positive(),
    citation: CitationSchema,
  })
  .refine((r) => {
    const expected = toFactUnit(r.value, r.unit, r.quantity);
    return expected !== null && Math.abs(expected - r.limit) < 0.05;
  }, "limit must be value converted from unit to the quantity's unit");
export type Requirement = z.infer<typeof RequirementSchema>;

/** Builds a requirement from the code's value and unit; the limit is calculated, never typed by hand. */
export function makeRequirement(r: Omit<Requirement, "limit">): Requirement {
  const limit = toFactUnit(r.value, r.unit, r.quantity);
  if (limit === null) throw new Error(`${r.id}: unit ${r.unit} does not fit ${r.quantity}`);
  return RequirementSchema.parse({ ...r, limit: Math.round(limit * 100) / 100 });
}
