import type { Severity } from "@shared/report";

const STYLE: Record<Severity, string> = {
  major: "bg-major/20 text-major border-major/40",
  minor: "bg-minor/20 text-minor border-minor/40",
};

export function SeverityBadge({ severity }: { severity: Severity }) {
  return <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${STYLE[severity]}`}>{severity}</span>;
}