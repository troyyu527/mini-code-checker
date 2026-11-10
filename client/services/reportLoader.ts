// Loads report.json and checks its shape with zod, so a broken file fails here with a clear message.
import { type Report, ReportSchema } from "@shared/report";

export type ReportLoader = (sampleId: string) => Promise<Report>;

export function createReportLoader(baseUrl: string, fetchFn: typeof fetch = fetch): ReportLoader {
  return async (sampleId) => {
    const res = await fetchFn(`${baseUrl}samples/${sampleId}/report.json`);
    if (!res.ok) throw new Error(`report.json: HTTP ${res.status}`);
    return ReportSchema.parse(await res.json());
  };
}