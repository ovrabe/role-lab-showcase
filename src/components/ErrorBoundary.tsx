import { track } from "../ai/track";
import { Component, type ErrorInfo, type ReactNode } from "react";

type ErrorBoundaryState = { hasError: boolean };

// Without this, any error while rendering leaves a blank page. React catches render
// errors only in a class component with these two methods, hence the class here.
export class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Rendering failed:", error, info.componentStack);
    track("client_error", "render");
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div role="alert" className="max-w-2xl mx-auto px-4 py-12 space-y-4">
        <h1>Něco se pokazilo</h1>
        <p>
          Stránku se nepodařilo zobrazit. Rozpracovaný úkol zůstává uložený v tvém prohlížeči, obnovení stránky ho
          nesmaže.
        </p>
        <p className="text-ink-muted">Když chyba trvá i po obnovení, dej vědět autorovi stránky.</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-full bg-action text-action-contrast px-4 py-2 font-medium"
        >
          Obnovit stránku
        </button>
      </div>
    );
  }
}
