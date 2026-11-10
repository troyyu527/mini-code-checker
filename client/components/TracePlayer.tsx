// Replays the report's recorded agent steps, one after another.
import { useEffect, useMemo, useState } from "react";
import type { TraceEntry } from "@shared/report";
import { buildTimeline, stepsShown } from "../services/playback";

export function TracePlayer({ trace }: { trace: TraceEntry[] }) {
  const timeline = useMemo(() => buildTimeline(trace), [trace]);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(0);

  useEffect(() => {
    if (startedAt === null) return;
    let frame = requestAnimationFrame(function tick(t) {
      setNow(t);
      if (t - startedAt < timeline.totalMs) frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame); // stop the loop when the component goes away
  }, [startedAt, timeline.totalMs]);

  const shown = startedAt === null ? 0 : stepsShown(timeline, now - startedAt);
  return (
    <section className="rounded-lg border border-line p-3">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-medium">Agent steps</h3>
        <button onClick={() => setStartedAt(performance.now())} className="ml-auto rounded-md border border-line px-2 py-0.5 text-xs">
          {startedAt === null ? "Replay" : "Replay again"}
        </button>
      </div>
      <ol className="mt-2 space-y-1 text-xs">
        {timeline.steps.slice(0, shown).map((s, i) => (
          <li key={i}>
            <span className="font-mono text-accent">{s.entry.agent}</span> {s.entry.summary}
          </li>
        ))}
      </ol>
    </section>
  );
}
