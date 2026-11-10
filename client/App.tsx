// App shell: header with the API status, tabs on the left, the 3D view and properties on the right.
import { useState } from "react";
import { APP_TITLE } from "@shared/app";
import { ReportPage } from "./components/ReportPage";
import { FAKE_REPORT } from "./fakeReport";

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

const TABS = ["Report", "Assistant"] as const;

export function App() {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Report");
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
            {tab === "Report" ? <ReportPage report={FAKE_REPORT} /> : <p className="p-4 text-sm text-muted">The assistant comes here (lesson 33).</p>}
          </div>
        </section>
        <section className="flex min-h-[24rem] flex-1 flex-col">
          <div className="grid flex-1 place-items-center text-muted">3D view (lesson 16)</div>
          <div className="h-48 border-t border-line p-3 text-sm text-muted">Properties (lesson 17)</div>
        </section>
      </main>
    </div>
  );
}
