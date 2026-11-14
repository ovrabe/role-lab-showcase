import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { applyThemeChoice, loadThemeChoice } from "./components/ThemeToggle";

// Before the first render, so a saved theme does not flash in the other one first.
applyThemeChoice(loadThemeChoice());
import "./index.css";
import "./phoneLayout.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
