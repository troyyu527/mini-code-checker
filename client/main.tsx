// Client entry: creates the services once and gives them to the app.
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { createApiClient } from "./services/apiClient";
import { createReportLoader } from "./services/reportLoader";
import "./styles/index.css";

const api = createApiClient(import.meta.env.VITE_API_URL ?? "http://localhost:8787");
const loadReport = createReportLoader(import.meta.env.BASE_URL);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App api={api} loadReport={loadReport} />
  </StrictMode>,
);