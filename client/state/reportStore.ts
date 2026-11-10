// Report state: the loaded report.json and the finding the user selected.
import { create } from "zustand";
import type { Report } from "@shared/report";
import type { ViewerCommand } from "@shared/viewerCommand";
import { useViewerStore } from "./viewerStore";

export type ReportStatus = "idle" | "loading" | "ready" | "error";

interface ReportState {
  status: ReportStatus;
  report: Report | null;
  selectedId: string | null;
  setLoading(): void;
  setReport(report: Report): void;
  setError(): void;
  /** Selects a finding and shows its element in the 3D view. */
  selectFinding(id: string): void;
}

/** The viewer command that colours every element with a finding. */
export function issuesCommand(report: Report): ViewerCommand {
  return { action: "show_issues", issues: report.findings.map((f) => ({ globalId: f.globalId, severity: f.severity })) };
}

export const useReportStore = create<ReportState>((set, get) => ({
  status: "idle",
  report: null,
  selectedId: null,
  setLoading: () => set({ status: "loading" }),
  setReport: (report) => set({ status: "ready", report }),
  setError: () => set({ status: "error", report: null }),
  selectFinding: (id) => {
    const finding = get().report?.findings.find((f) => f.id === id);
    if (!finding) return;
    set({ selectedId: id });
    // one store may call another store's action: the report knows the element, the viewer knows how to show it
    useViewerStore.getState().runWhenReady(
      [
        { action: "highlight", globalIds: [finding.globalId] },
        { action: "zoom", globalIds: [finding.globalId] },
      ],
      finding.globalId,
    );
  },
}));
