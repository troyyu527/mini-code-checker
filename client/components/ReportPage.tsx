// QA report: counts, severity filter and the findings list. Reads and changes state through the stores.
import { SEVERITIES } from "@shared/report";
import { useReportStore } from "../state/reportStore";
import { useUiStore } from "../state/uiStore";
import { FindingCard } from "./FindingCard";

export function ReportPage() {
  const { status, report, selectedId, selectFinding } = useReportStore();
  const severities = useUiStore((s) => s.severities);
  const toggleSeverity = useUiStore((s) => s.toggleSeverity);

  if (status === "loading" || status === "idle") return <p className="p-4 text-sm text-muted">Loading report…</p>;
  if (status === "error" || !report) return <p className="p-4 text-sm text-major">The report could not be loaded.</p>;

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
            <input type="checkbox" checked={severities.includes(s)} onChange={() => toggleSeverity(s)} />
            {s} ({report.findings.filter((f) => f.severity === s).length})
          </label>
        ))}
      </div>
      {shown.map((f) => (
        <FindingCard key={f.id} finding={f} requirement={requirements.get(f.requirementId)} selected={f.id === selectedId} onView={selectFinding} />
      ))}
      {shown.length === 0 && <p className="text-sm text-muted">No findings match the filter.</p>}
    </div>
  );
}