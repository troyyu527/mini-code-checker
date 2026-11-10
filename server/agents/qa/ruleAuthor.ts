// Rule Author agent: reads the found clauses and writes ONE checkable rule for the topic (or says there is none).
import { z } from "zod";
import { OPERATORS } from "@shared/requirement";
import { quantityKind, toFactUnit, UNITS } from "@shared/units";
import type { LlmClient } from "../../services/llm";
import { askJson } from "../../services/structured";
import type { Topic } from "./topics";

export interface Passage {
  chunkId: string;
  section: string;
  provisions: string[];
  page: number | null;
  sourceUrl: string;
  body: string;
}

const SYSTEM = `You turn building-code text into one machine-checkable rule for an office building (occupancy Group B).
You get one check topic (an IFC element type and the quantity measured on it) and numbered code passages.
- op is ">=" for a minimum ("not less than", "minimum") and "<=" for a maximum.
- value and unit as the code states the limit (unit one of: ${UNITS.join(", ")}); use inches for "7 feet 6 inches" (90 in).
- chunkId: the passage the limit comes from. quote: copy the sentence part with the limit WORD FOR WORD (max 300 characters).
- excludeObjectTypes: room or element kinds from the given list that the code gives a different limit (else []).
- The limit must be about this element itself. Skip exceptions and other occupancy groups.
- If no passage states a limit for this quantity, reply {"rule": null, "noRule": "<one sentence why>"}.
Reply with JSON only, e.g.
{"rule": {"title": "Minimum door clear width", "op": ">=", "value": 32, "unit": "in", "chunkId": "S022#051",
"quote": "shall provide a minimum clear width of 32 inches (812.2 mm)", "excludeObjectTypes": []}}`;

export const AuthoredRuleSchema = z.object({
  title: z.string().min(3).max(160),
  op: z.enum(OPERATORS),
  value: z.number().positive(),
  unit: z.enum(UNITS),
  chunkId: z.string(),
  quote: z.string().min(10).max(400),
  excludeObjectTypes: z.array(z.string()).max(10).default([]),
});
export type AuthoredRule = z.infer<typeof AuthoredRuleSchema>;

const ReplySchema = z.object({ rule: AuthoredRuleSchema.nullable(), noRule: z.string().optional() });

export async function authorRule(
  llm: LlmClient,
  input: { topic: Topic; passages: Passage[]; objectTypes: string[]; feedback: string[] },
): Promise<{ rule: AuthoredRule | null; noRule?: string }> {
  const { topic, passages } = input;
  // plain-code checks that zod alone cannot do: the passage must exist and the unit must fit the quantity
  const schema = ReplySchema.refine((r) => !r.rule || passages.some((p) => p.chunkId === r.rule!.chunkId), "chunkId must be one of the passages").refine(
    (r) => !r.rule || toFactUnit(r.rule.value, r.rule.unit, topic.quantity) !== null,
    `unit does not fit ${topic.quantity} (a ${quantityKind(topic.quantity)})`,
  );
  const user = [
    `Topic: ${topic.title} — element type ${topic.appliesTo}, quantity ${topic.quantity} (${quantityKind(topic.quantity)}).`,
    input.objectTypes.length ? `Kinds of ${topic.appliesTo} in the model (objectType): ${input.objectTypes.join(", ")}.` : "",
    input.feedback.length ? `A reviewer rejected your previous rule:\n- ${input.feedback.join("\n- ")}\nWrite the corrected rule.` : "",
    `Passages:\n${passages.map((p) => `[${p.chunkId}] §${p.section}, p. ${p.page ?? "-"}\n${p.body}`).join("\n\n")}`,
  ]
    .filter(Boolean)
    .join("\n\n");
  return askJson(llm, [{ role: "system", content: SYSTEM }, { role: "user", content: user }], schema);
}
