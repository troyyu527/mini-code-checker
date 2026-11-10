// The selected element: its facts, its IFC properties and its findings.
import { describeFinding } from "@shared/report";
import { formatFact } from "@shared/units";
import { useReportStore } from "../state/reportStore";
import { useViewerStore } from "../state/viewerStore";

export function PropertiesPanel() {
  const selectedId = useViewerStore((s) => s.selectedId);
  const model = useViewerStore((s) => s.model);
  // select the report itself (same object every time), not `s.report?.findings ?? []`: a new [] on each call makes
  // Zustand think the state changed, re-render, call again … "Maximum update depth exceeded"
  const report = useReportStore((s) => s.report);
  const findings = report?.findings ?? [];

  const fact = model?.facts.find((f) => f.globalId === selectedId);
  if (!fact) return <p className="p-3 text-sm text-muted">Click an element to see its properties.</p>;
  const props = model!.properties.filter((p) => p.globalId === fact.globalId);
  const mine = findings.filter((f) => f.globalId === fact.globalId);

  return (
    <div className="space-y-2 overflow-y-auto p-3 text-sm" data-testid="properties">
      <h3 className="font-medium">
        {fact.name ?? "(no name)"} <span className="text-muted">{fact.ifcType}</span>
      </h3>
      <dl className="grid grid-cols-2 gap-x-3 text-xs">
        <dt className="text-muted">Storey</dt>
        <dd>{fact.storey ?? "—"}</dd>
        {Object.entries(fact.dims).map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-muted">{k}</dt>
            <dd>{formatFact(v, k)}</dd>
          </div>
        ))}
        {props.map((p) => (
          <div key={`${p.set}.${p.name}`} className="contents">
            <dt className="text-muted">{p.name}</dt>
            <dd>{String(p.value)}</dd>
          </div>
        ))}
      </dl>
      {mine.map((f) => (
        <p key={f.id} className={f.severity === "major" ? "text-major" : "text-minor"}>
          {f.id}: {describeFinding(f)}
        </p>
      ))}
    </div>
  );
}
