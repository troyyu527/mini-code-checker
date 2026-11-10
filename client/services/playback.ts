// Playback: replays the recorded agent steps of a report in a few seconds. Pure: time comes in as a number.
import type { TraceEntry } from "@shared/report";

export interface TimelineStep {
  entry: TraceEntry;
  startMs: number;
  durationMs: number;
}

/** Every step gets at least `minMs`; the rest of `totalMs` is shared in proportion to the recorded time. */
export function buildTimeline(trace: TraceEntry[], totalMs = 6000, minMs = 300): { steps: TimelineStep[]; totalMs: number } {
  if (!trace.length) return { steps: [], totalMs: 0 };
  const spare = Math.max(0, totalMs - minMs * trace.length);
  const recorded = trace.reduce((n, t) => n + t.ms, 0) || 1;
  let at = 0;
  const steps = trace.map((entry) => {
    const durationMs = Math.round(minMs + (spare * entry.ms) / recorded);
    const step = { entry, startMs: at, durationMs };
    at += durationMs;
    return step;
  });
  return { steps, totalMs: at };
}

/** How many steps have started after `elapsedMs`. */
export function stepsShown(timeline: { steps: TimelineStep[] }, elapsedMs: number): number {
  return timeline.steps.filter((s) => s.startMs <= elapsedMs).length;
}