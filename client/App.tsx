// App shell: header with the API status, tabs on the left, the 3D view and properties on the right.
import { lazy, Suspense, useEffect } from "react";
import { APP_TITLE } from "@shared/app";
import { PropertiesPanel } from "./components/PropertiesPanel";
import { ReportPage } from "./components/ReportPage";
import type { ReportLoader } from "./services/reportLoader";
import { useReportStore } from "./state/reportStore";
import { TABS, useUiStore } from "./state/uiStore";

// Downloaded only when it is first shown: lesson 16 puts Three.js (≈ 0.5 MB) in here
const Viewport = lazy(() => import("./components/Viewport").then((m) => ({ default: m.Viewport })));

const SAMPLE_ID = "office";

type ApiStatus = "checking" | "ok" | "down";

function ApiBadge({ status }: { status: ApiStatus }) {
  const dot = status === "ok" ? "bg-ok" : status === "down" ? "bg-major" : "bg-minor";
  return (
    <span className="flex items-center gap-2 rounded-full border border-line px-3 py-1 text-sm">
      <span className={`size-2 rounded-full ${dot}`} />
      API: {status === "ok" ? "ok" : status === "down" ? "offline" : "…"}
    </span>
  );
}

export function App({ loadReport }: { loadReport: ReportLoader }) {
  const tab = useUiStore((s) => s.tab);
  const setTab = useUiStore((s) => s.setTab);

  useEffect(() => {
    let live = true; // set to false by the cleanup: an answer that arrives later is ignored
    const store = useReportStore.getState();
    store.setLoading();
    loadReport(SAMPLE_ID)
      .then((r) => live && store.setReport(r))
      .catch(() => live && store.setError());
    return () => {
      live = false;
    };
  }, [loadReport]);

  useEffect(() => {
    document.title = `${tab} · ${APP_TITLE}`;
  }, [tab]);

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-4 border-b border-line px-5 py-3">
        <div className="flex-1">
          <h1 className="text-lg font-semibold">{APP_TITLE}</h1>
          <p className="text-xs text-muted">One-storey office · NYC Building Code checks</p>
        </div>
        <ApiBadge status="checking" />
      </header>
      <main className="flex min-h-0 flex-1 flex-col md:flex-row">
        <section className="flex min-h-0 flex-col border-line md:w-[28rem] md:border-r">
          <nav className="flex gap-1 border-b border-line px-3" role="tablist">
            {TABS.map((t) => (
              <button
                key={t}
                role="tab"
                aria-selected={t === tab}
                onClick={() => setTab(t)}
                className={`border-b-2 px-3 py-2 text-sm ${t === tab ? "border-accent" : "border-transparent text-muted"}`}
              >
                {t}
              </button>
            ))}
          </nav>
          <div className="min-h-0 flex-1 overflow-hidden">
            {tab === "Report" ? <ReportPage /> : <p className="p-4 text-sm text-muted">The assistant comes here (lesson 33).</p>}
          </div>
        </section>
        <section className="flex min-h-[24rem] flex-1 flex-col">
          <div className="min-h-0 flex-1">
            <Suspense fallback={<p className="p-4 text-sm text-muted">Loading 3D viewer…</p>}>
              <Viewport modelUrl={`${import.meta.env.BASE_URL}samples/${SAMPLE_ID}/arch.ifc`} />
            </Suspense>
          </div>
          <div className="h-48 border-t border-line">
            <PropertiesPanel />
          </div>
        </section>
      </main>
    </div>
  );
}
