import { describe, expect, it } from "vitest";
import { buildTimeline, stepsShown } from "../../client/services/playback";
import { createReportLoader } from "../../client/services/reportLoader";
import { FAKE_REPORT } from "../fakes/report";

/** A fetch that always answers with this body and status, and remembers the URL it was asked for. */
function fakeFetch(body: unknown, status = 200) {
  const urls: string[] = [];
  const fn = (async (url: string) => {
    urls.push(url);
    return new Response(JSON.stringify(body), { status });
  }) as unknown as typeof fetch;
  return { fn, urls };
}

describe("reportLoader", () => {
  it("builds the URL from the base path and returns the checked report", async () => {
    const { fn, urls } = fakeFetch(FAKE_REPORT);
    const report = await createReportLoader("/mini-code-checker/", fn)("office");
    expect(urls).toEqual(["/mini-code-checker/samples/office/report.json"]);
    expect(report.findings).toHaveLength(3);
  });
  it("fails with the HTTP status when the file is missing", async () => {
    await expect(createReportLoader("/", fakeFetch({}, 404).fn)("office")).rejects.toThrow("HTTP 404");
  });
  it("fails when the file has the wrong shape", async () => {
    const broken = { ...FAKE_REPORT, findings: [{ ...FAKE_REPORT.findings[0], severity: "critical" }] };
    await expect(createReportLoader("/", fakeFetch(broken).fn)("office")).rejects.toThrow(/severity/);
  });
});

describe("playback", () => {
  it("gives every step at least the minimum time and fits the total", () => {
    const t = buildTimeline([{ agent: "a", summary: "", ms: 0 }, { agent: "b", summary: "", ms: 9000 }], 6000, 300);
    expect(t.steps.map((s) => s.durationMs)).toEqual([300, 5700]);
    expect(stepsShown(t, 0)).toBe(1);
    expect(stepsShown(t, 300)).toBe(2);
  });
  it("an empty trace is an empty timeline", () => {
    expect(buildTimeline([]).totalMs).toBe(0);
  });
});