// Report state: the loaded report and the finding the user selected.
import { create } from "zustand";
import type { Report } from "@shared/report";

export type ReportStatus = "idle" | "loading" | "ready" | "error";

interface ReportState {
  status: ReportStatus;
  report: Report | null;
  selectedId: string | null;
  setLoading(): void;
  setReport(report: Report): void;
  setError(): void;
  selectFinding(id: string): void;
}

export const useReportStore = create<ReportState>((set, get) => ({
  status: "idle",
  report: null,
  selectedId: null,
  setLoading: () => set({ status: "loading" }),
  setReport: (report) => set({ status: "ready", report }),
  setError: () => set({ status: "error", report: null }),
  selectFinding: (id) => {
    if (!get().report?.findings.some((f) => f.id === id)) return; // unknown id: ignore
    set({ selectedId: id });
  },
}));