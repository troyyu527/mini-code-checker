// The selected element: its GlobalId and its findings. Lesson 18 adds the element's facts and IFC properties.
import { describeFinding } from "@shared/report";
import { useReportStore } from "../state/reportStore";
import { useViewerStore } from "../state/viewerStore";

export function PropertiesPanel() {
  const selectedId = useViewerStore((s) => s.selectedId);
  // select the report itself (same object every time), not `s.report?.findings ?? []` (lesson 12)
  const report = useReportStore((s) => s.report);

  if (!selectedId) return <p className="p-3 text-sm text-muted">Click an element to see its properties.</p>;
  const mine = (report?.findings ?? []).filter((f) => f.globalId === selectedId);

  return (
    <div className="space-y-2 overflow-y-auto p-3 text-sm" data-testid="properties">
      <h3 className="font-mono text-xs text-muted">{selectedId}</h3>
      {mine.length === 0 && <p className="text-muted">No findings for this element.</p>}
      {mine.map((f) => (
        <p key={f.id} className={f.severity === "major" ? "text-major" : "text-minor"}>
          {f.id} {f.element}: {describeFinding(f)}
        </p>
      ))}
    </div>
  );
}
