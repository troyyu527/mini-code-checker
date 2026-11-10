// Client entry: creates the services once and gives them to the app.
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { createReportLoader } from "./services/reportLoader";
import "./styles/index.css";

const loadReport = createReportLoader(import.meta.env.BASE_URL);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App loadReport={loadReport} />
  </StrictMode>,
);