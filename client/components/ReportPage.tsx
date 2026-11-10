// QA report: counts, severity filter and the findings list. State lives in this component for now (lesson 12 moves it).
import { useState } from "react";
import { type Report, type Severity, SEVERITIES } from "@shared/report";
import { FindingCard } from "./FindingCard";

export function ReportPage({ report }: { report: Report }) {
  const [severities, setSeverities] = useState<Severity[]>(["major", "minor"]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const toggle = (s: Severity) =>
    setSeverities((current) => (current.includes(s) ? current.filter((x) => x !== s) : [...current, s]));

  // derived data: calculated from state on every render, never stored separately
  const requirements = new Map(report.requirements.map((r) => [r.id, r]));
  const shown = report.findings.filter((f) => severities.includes(f.severity));

  return (
    <div className="flex flex-col gap-3 overflow-y-auto p-4">
      <p className="text-sm text-muted">
        {report.findings.length} findings from {report.requirements.length} rules ({report.rulesBy}) · {report.notEvaluated} not evaluated
      </p>
      <div className="flex gap-2" role="group" aria-label="Severity filter">
        {SEVERITIES.map((s) => (
          <label key={s} className="flex items-center gap-1 text-sm">
            <input type="checkbox" checked={severities.includes(s)} onChange={() => toggle(s)} />
            {s} ({report.findings.filter((f) => f.severity === s).length})
          </label>
        ))}
      </div>
      {shown.map((f) => (
        <FindingCard key={f.id} finding={f} requirement={requirements.get(f.requirementId)} selected={f.id === selectedId} onView={setSelectedId} />
      ))}
      {shown.length === 0 && <p className="text-sm text-muted">No findings match the filter.</p>}
    </div>
  );
}