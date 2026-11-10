// Chat graph (LangGraph): Supervisor → Researcher (code search) or Findings (QA report) → Writer.
// Every node adds trace steps; the session agent streams them while the run goes on.
import { Annotation, END, MemorySaver, START, StateGraph } from "@langchain/langgraph";
import type { AgentResponse, TraceStep } from "@shared/contracts";
import type { ElementFacts } from "@shared/elementFacts";
import { describeFinding } from "@shared/report";
import type { ViewerCommand } from "@shared/viewerCommand";
import type { CodeSearch } from "../../services/codeSearch";
import type { LlmClient } from "../../services/llm";
import type { FindingWithRule } from "../../services/modelData";
import { type Decision, supervise } from "./supervisor";
import { researchCode } from "./research";
import { DONT_KNOW, type EvidenceItem, markCitations, type NewEvidence, publicEvidence, writeAnswer } from "./writer";

// A "replace" channel keeps the newest value; the trace channel appends.
const replace = <T>(d: () => T) => Annotation<T>({ reducer: (_, b) => b, default: d });

const State = Annotation.Root({
  message: Annotation<string>,
  decision: replace<Decision | null>(() => null),
  evidence: replace<EvidenceItem[]>(() => []),
  viewerCommands: replace<ViewerCommand[]>(() => []),
  answer: replace(() => ""),
  trace: Annotation<TraceStep[]>({ reducer: (a, b) => a.concat(b), default: () => [] }),
});
export type ChatState = typeof State.State;

export interface ChatDeps {
  llm: LlmClient;
  search: CodeSearch;
  facts(): Promise<ElementFacts[]>;
  findings(globalIds?: string[]): Promise<FindingWithRule[]>;
}

const timed = async <T>(fn: () => Promise<T>) => {
  const t = performance.now();
  const value = await fn();
  return { value, ms: Math.round(performance.now() - t) };
};

export function buildChatGraph(deps: ChatDeps) {
  const { llm } = deps;
  return new StateGraph(State)
    .addNode("supervisor", async (s) => {
      const { value, ms } = await timed(async () => supervise(llm, { message: s.message, facts: await deps.facts(), findings: await deps.findings() }));
      const target = value.route === "finding" ? ` · ${value.names.join(", ")}` : value.route === "question" ? ` · "${value.query}"` : "";
      return { decision: value, trace: [{ agent: "supervisor", ms, summary: `route: ${value.route}${target}` }] };
    })
    .addNode("researcher", async (s) => {
      const d = s.decision as Extract<Decision, { route: "question" }>;
      const { value, ms } = await timed(() => researchCode(deps.search, d.query));
      const found = value.map((e) => (e.kind === "code" ? `§${e.section}` : "")).join(", ");
      return { evidence: value, trace: [{ agent: "researcher", ms, summary: `search_code "${d.query}" → ${found || "nothing found"}` }] };
    })
    .addNode("findings", async (s) => {
      const d = s.decision as Extract<Decision, { route: "finding" }>;
      const { value, ms } = await timed(() => deps.findings(d.globalIds));
      const evidence: EvidenceItem[] = [];
      const add = (e: NewEvidence) => evidence.push({ ...e, id: `E${evidence.length + 1}` });
      for (const { finding: f, requirement: r } of value) {
        const fact = `${describeFinding(f)}; severity: ${f.severity}`;
        add({ kind: "finding", findingId: f.id, globalId: f.globalId, element: f.element, fact, text: `${f.id} ${f.element} (${f.ifcType}): ${fact}. Rule: ${r?.title ?? f.requirementId}.` });
        const c = r?.citation;
        if (c && !evidence.some((e) => e.kind === "code" && e.chunkId === c.chunkId)) {
          add({ kind: "code", chunkId: c.chunkId, section: c.section, page: c.page, sourceUrl: c.sourceUrl, quote: c.quote, text: c.quote });
        }
      }
      const note = value.length ? [] : [{ id: "E1", kind: "finding" as const, findingId: "-", globalId: d.globalIds[0] ?? "", element: d.names.join(", "), fact: "no findings", text: `${d.names.join(", ")}: the QA report has no findings for these elements; they passed the checked rules.` }];
      const ids = d.globalIds.slice(0, 200);
      return {
        evidence: value.length ? evidence : note,
        viewerCommands: ids.length ? [{ action: "highlight", globalIds: ids }, { action: "zoom", globalIds: ids }] : [],
        trace: [{ agent: "findings", ms, summary: `get_findings → ${value.map((x) => `${x.finding.id} ${x.finding.element}`).join(", ") || "no findings"}` }],
      };
    })
    .addNode("writer", async (s) => {
      const d = s.decision!;
      if (d.route === "ask_user") return { answer: d.clarify };
      if (d.route === "question" && !s.evidence.length) return { answer: DONT_KNOW, trace: [{ agent: "writer", summary: "no passages found" }] };
      const needsCode = d.route === "question";
      const { value, ms } = await timed(() => writeAnswer(llm, { message: s.message, evidence: s.evidence, needsCode }));
      if (!value.enough && needsCode) return { answer: DONT_KNOW, evidence: [], trace: [{ agent: "writer", ms, summary: "the passages do not answer it → I don't know" }] };
      return {
        answer: markCitations(value.answer, value.cites),
        evidence: needsCode ? s.evidence.filter((e) => value.cites.includes(e.id)) : s.evidence,
        trace: [{ agent: "writer", ms, summary: `answer citing ${value.cites.join(", ") || "nothing"}` }],
      };
    })
    .addEdge(START, "supervisor")
    .addConditionalEdges("supervisor", (s) => ({ question: "researcher", finding: "findings", ask_user: "writer" })[s.decision!.route], [
      "researcher",
      "findings",
      "writer",
    ])
    .addEdge("researcher", "writer")
    .addEdge("findings", "writer")
    .addEdge("writer", END)
    .compile({ checkpointer: new MemorySaver() });
}

export type ChatGraph = ReturnType<typeof buildChatGraph>;

/** Runs one message; `onTrace` gets each trace step as soon as its node finishes. */
export async function runChat(graph: ChatGraph, runId: string, message: string, onTrace: (step: TraceStep) => void = () => {}): Promise<ChatState> {
  const config = { configurable: { thread_id: runId } };
  const stream = await graph.stream({ message }, { ...config, streamMode: "updates" as const });
  for await (const chunk of stream) {
    for (const update of Object.values(chunk as Record<string, Partial<ChatState> | undefined>)) {
      for (const step of update?.trace ?? []) onTrace(step);
    }
  }
  return (await graph.getState(config)).values as ChatState;
}

export function toResponse(s: ChatState, usage: AgentResponse["usage"]): AgentResponse {
  return {
    route: s.decision?.route ?? "ask_user",
    answer: s.answer,
    evidence: publicEvidence(s.evidence),
    viewerCommands: s.viewerCommands,
    trace: s.trace,
    usage,
  };
}
