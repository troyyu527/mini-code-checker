// Code search: the shape of a search hit and of the query. Lesson 24 adds the keyword and quote helpers.
import { z } from "zod";

export interface CodeHit {
  chunkId: string;
  section: string;
  provisions: string[];
  page: number | null;
  sourceUrl: string;
  /** A word-for-word piece of the clause, at most QUOTE_MAX characters. */
  quote: string;
  /** Which searches found it: "keyword", "vector". */
  foundBy: string[];
}

export const CodeSearchQuerySchema = z.object({
  q: z.string().trim().min(2).max(300),
  k: z.coerce.number().int().min(1).max(10).default(5),
});