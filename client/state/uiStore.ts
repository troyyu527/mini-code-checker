// UI state: which tab is open and which severities the report shows.
import { create } from "zustand";
import type { Severity } from "@shared/report";

export const TABS = ["Report", "Assistant"] as const;
export type Tab = (typeof TABS)[number];

interface UiState {
  tab: Tab;
  severities: Severity[];
  setTab(tab: Tab): void;
  toggleSeverity(s: Severity): void;
}

export const useUiStore = create<UiState>((set) => ({
  tab: "Report",
  severities: ["major", "minor"],
  setTab: (tab) => set({ tab }),
  toggleSeverity: (s) =>
    set((state) => ({
      severities: state.severities.includes(s) ? state.severities.filter((x) => x !== s) : [...state.severities, s],
    })),
}));