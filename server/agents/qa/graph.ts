// QA graph (LangGraph): for each topic Researcher → Rule Author → Reviewer; a rejected rule goes back to the Rule
// Author with the reviewer's feedback (at most 3 attempts). At the end the deterministic Checker builds the report.
import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { provisionOf } from "@shared/codeSearch";
import type { ElementFacts } from "@shared/elementFacts";
import { buildReport, type Report, type TraceEntry } from "@shared/report";
import { makeRequirement, type Requirement } from "@shared/requirement";
import type { CodeSearch } from "../../services/codeSearch";
import type { LlmClient } from "../../services/llm";
import { type AuthoredRule, authorRule, type Passage } from "./ruleAuthor";
import { reviewRule } from "./reviewer";
import type { Topic } from "./topics";

export const MAX_ATTEMPTS = 3;
const PASSAGES = 4;

const replace = <T>(d: () => T) => Annotation<T>({ reducer: (_, b) => b, default: d });
const concat = <T>() => Annotation<T[]>({ reducer: (a, b) => a.concat(b), default: () => [] });

const State = Annotation.Root({
  topics: Annotation<Topic[]>,
  facts: Annotation<ElementFacts[]>,
  index: replace(() => 0),
  passages: replace<Passage[]>(() => []),
  candidate: replace<AuthoredRule | null>(() => null),
  feedback: replace<string[]>(() => []),
  attempts: replace(() => 0),
  accepted: concat<{ topic: Topic; rule: AuthoredRule; passage: Passage }>(),
  trace: concat<TraceEntry>(),
  report: replace<Report | null>(() => null),
});
type QaState = typeof State.State;

/** What changes when we move on to the next topic. */
const nextTopic = (s: QaState) => ({ index: s.index + 1, passages: [], candidate: null, feedback: [], attempts: 0 });

const timed = async <T>(fn: () => Promise<T>) => {
  const t = performance.now();
  const value = await fn();
  return { value, ms: Math.round(performance.now() - t) };
};

export function buildQaGraph(deps: { llm: LlmClient; search: CodeSearch; model: string; sampleId: string }) {
  return new StateGraph(State)
    .addNode("researcher", async (s) => {
      const topic = s.topics[s.index];
      const { value, ms } = await timed(async () => {
        const hits = await deps.search.search(topic.query, PASSAGES);
        const bodies = await Promise.all(hits.map((h) => deps.search.body(h.chunkId)));
        return hits.flatMap((h, i): Passage[] => (bodies[i] ? [{ chunkId: h.chunkId, section: h.section, provisions: h.provisions, page: h.page, sourceUrl: h.sourceUrl, body: bodies[i]! }] : []));
      });
      return { passages: value, trace: [{ agent: "researcher", ms, summary: `${topic.id}: "${topic.query}" → ${value.map((p) => `§${p.section}`).join(", ")}` }] };
    })
    .addNode("rule_author", async (s) => {
      const topic = s.topics[s.index];
      const objectTypes = [...new Set(s.facts.filter((f) => f.ifcType === topic.appliesTo).map((f) => f.objectType).filter((x): x is string => !!x))];
      const { value, ms } = await timed(() => authorRule(deps.llm, { topic, passages: s.passages, objectTypes, feedback: s.feedback }));
      const r = value.rule;
      const summary = r ? `${topic.id}: ${r.op} ${r.value} ${r.unit} from ${r.chunkId}` : `${topic.id}: no rule (${value.noRule ?? "no limit found"})`;
      return { candidate: r, attempts: s.attempts + 1, trace: [{ agent: "rule_author", ms, summary }] };
    })
    .addNode("reviewer", async (s) => {
      const topic = s.topics[s.index];
      if (!s.candidate) return { ...nextTopic(s), trace: [{ agent: "reviewer", ms: 0, summary: `${topic.id}: nothing to review` }] };
      const { problems, quote, repaired } = reviewRule(s.candidate, topic, s.passages);
      if (!problems.length) {
        const passage = s.passages.find((p) => p.chunkId === s.candidate!.chunkId)!;
        const summary = repaired ? `${topic.id}: accepted, quote replaced by the exact sentence "${quote}"` : `${topic.id}: accepted`;
        return { ...nextTopic(s), accepted: [{ topic, rule: { ...s.candidate, quote }, passage }], trace: [{ agent: "reviewer", ms: 0, summary }] };
      }
      const giveUp = s.attempts >= MAX_ATTEMPTS;
      return {
        ...(giveUp ? nextTopic(s) : { feedback: problems }),
        trace: [{ agent: "reviewer", ms: 0, summary: `${topic.id}: rejected "${s.candidate.quote}" (${problems.join("; ")})${giveUp ? " → give up" : " → back to the Rule Author"}` }],
      };
    })
    .addNode("checker", async (s) => {
      const requirements: Requirement[] = s.accepted.map(({ topic, rule, passage }, i) =>
        makeRequirement({
          id: `R-${String(i + 1).padStart(2, "0")}`,
          title: rule.title,
          appliesTo: topic.appliesTo,
          where: rule.excludeObjectTypes.length ? [{ field: "objectType", op: "not_in", values: rule.excludeObjectTypes }] : [],
          quantity: topic.quantity,
          op: rule.op,
          value: rule.value,
          unit: rule.unit,
          citation: {
            chunkId: passage.chunkId,
            section: provisionOf(passage.body, rule.quote, passage.provisions) ?? passage.section,
            page: passage.page,
            sourceUrl: passage.sourceUrl,
            quote: rule.quote.trim(),
          },
        }),
      );
      const { value: report, ms } = await timed(async () => buildReport({ sampleId: deps.sampleId, rulesBy: deps.model, requirements, facts: s.facts }));
      const entry = { agent: "checker", ms, summary: `${requirements.length} rules on ${s.facts.length} elements → ${report.findings.length} findings` };
      return { report: { ...report, trace: [...s.trace, entry] }, trace: [entry] };
    })
    .addEdge(START, "researcher")
    .addEdge("researcher", "rule_author")
    .addEdge("rule_author", "reviewer")
    .addConditionalEdges(
      "reviewer",
      // feedback waiting → try again; otherwise the next topic, or the checker after the last one
      (s) => (s.feedback.length && s.attempts < MAX_ATTEMPTS ? "rule_author" : s.index < s.topics.length ? "researcher" : "checker"),
      ["rule_author", "researcher", "checker"],
    )
    .addEdge("checker", END)
    .compile();
}

export async function runQa(graph: ReturnType<typeof buildQaGraph>, topics: Topic[], facts: ElementFacts[], onTrace: (t: TraceEntry) => void = () => {}): Promise<Report> {
  let report: Report | null = null;
  // every node is one "step"; 3 topics × up to 7 steps is more than LangGraph's default limit of 25
  const stream = await graph.stream({ topics, facts }, { streamMode: "updates", recursionLimit: 100 });
  for await (const chunk of stream) {
    for (const update of Object.values(chunk as Record<string, Partial<QaState>>)) {
      update.trace?.forEach(onTrace);
      if (update.report) report = update.report;
    }
  }
  if (!report) throw new Error("the QA run ended without a report");
  return report;
}
