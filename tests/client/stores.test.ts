import { beforeEach, describe, expect, it } from "vitest";
import { useReportStore } from "../../client/state/reportStore";
import { useUiStore } from "../../client/state/uiStore";
import { FAKE_REPORT } from "../../client/fakeReport";

describe("uiStore", () => {
  beforeEach(() => useUiStore.setState({ tab: "Report", severities: ["major", "minor"] }));

  it("toggles a severity off and on again", () => {
    useUiStore.getState().toggleSeverity("major");
    expect(useUiStore.getState().severities).toEqual(["minor"]);
    useUiStore.getState().toggleSeverity("major");
    expect(useUiStore.getState().severities).toEqual(["minor", "major"]);
  });
});

describe("reportStore", () => {
  beforeEach(() => useReportStore.setState({ status: "idle", report: null, selectedId: null }));

  it("selects a finding that exists, and ignores one that does not", () => {
    useReportStore.getState().setReport(FAKE_REPORT);
    useReportStore.getState().selectFinding("F-02");
    expect(useReportStore.getState().selectedId).toBe("F-02");
    useReportStore.getState().selectFinding("F-99");
    expect(useReportStore.getState().selectedId).toBe("F-02");
  });
});