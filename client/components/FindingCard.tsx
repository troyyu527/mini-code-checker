// One finding: element, measured vs required value, the rule's code citation, and "View in model".
import { describeFinding, type Finding, type Requirement } from "@shared/report";
import { SeverityBadge } from "./SeverityBadge";

interface Props {
  finding: Finding;
  requirement: Requirement | undefined;
  selected: boolean;
  onView(id: string): void;
}

export function FindingCard({ finding, requirement, selected, onView }: Props) {
  return (
    <article
      className={`rounded-lg border p-3 ${selected ? "border-accent bg-accent/10" : "border-line"}`}
      data-testid={`finding-${finding.id}`}
    >
      <header className="flex items-center gap-2">
        <span className="font-mono text-xs text-muted">{finding.id}</span>
        <span className="font-medium">{finding.element}</span>
        <span className="text-xs text-muted">{finding.ifcType}</span>
        <span className="ml-auto">
          <SeverityBadge severity={finding.severity} />
        </span>
      </header>
      <p className="mt-2 text-sm">{describeFinding(finding)}</p>
      {requirement && (
        <p className="mt-1 text-xs text-muted">
          {requirement.title} · NYC BC §{requirement.citation.section}: “{requirement.citation.quote}”
        </p>
      )}
      <button onClick={() => onView(finding.id)} className="mt-2 rounded-md bg-accent px-2 py-1 text-xs">
        View in model
      </button>
    </article>
  );
}