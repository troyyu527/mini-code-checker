import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { FAKE_REPORT } from "./fakeReport";
import { useReportStore } from "./state/reportStore";
import "./styles/index.css";

// A store can be used outside React: put the fake report in before the first render (lesson 14 loads report.json).
useReportStore.getState().setReport(FAKE_REPORT);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);