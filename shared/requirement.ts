// Requirement: one code rule. For now only what the report shows; lesson 19 adds what the checker needs.
import { z } from "zod";

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

export const OPERATORS = [">=", "<=", ">", "<"] as const;
export type Operator = (typeof OPERATORS)[number];

export const RequirementSchema = z.object({
  id: z.string().regex(/^R-\d{2}$/),
  title: z.string().min(3).max(160),
  citation: CitationSchema,
});
export type Requirement = z.infer<typeof RequirementSchema>;