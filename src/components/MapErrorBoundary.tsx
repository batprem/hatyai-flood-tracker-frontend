/**
 * Error boundary that isolates the dashboard map from the rest of the app.
 *
 * If MapLibre fails to initialise — e.g. tile fetch failure, WebGL unavailable,
 * a regression in the map style code path (HFT-17) — we catch the throw here
 * so the surrounding public alert UI keeps rendering. Public-safety copy is
 * routed through `forecastFrames` i18n so the fallback state stays
 * translation-ready.
 */
import { AlertTriangle } from "lucide-react";
import { Component, type ErrorInfo, type ReactNode } from "react";

import type { ForecastFramesCopy } from "@/lib/i18n/forecastFrames";

interface MapErrorBoundaryProps {
  copy: ForecastFramesCopy;
  children: ReactNode;
}

interface MapErrorBoundaryState {
  error: Error | null;
}

/**
 * Class component is the only way to use React's error-boundary lifecycle
 * (`getDerivedStateFromError` / `componentDidCatch`); the rest of the app
 * stays on function components per `frontend.md` conventions.
 */
export class MapErrorBoundary extends Component<
  MapErrorBoundaryProps,
  MapErrorBoundaryState
> {
  state: MapErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): MapErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Surface the failure for ops debugging without crashing the page.
    // eslint-disable-next-line no-console
    console.error("[BasinMap] failed to render", error, info);
  }

  private handleReload = (): void => {
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  render(): ReactNode {
    const { error } = this.state;
    if (error == null) {
      return this.props.children;
    }
    const { copy } = this.props;
    return (
      <div
        role="alert"
        data-testid="basin-map-error"
        className="flex h-full min-h-[420px] flex-col items-center justify-center gap-3 rounded-[2rem] border border-amber-200 bg-amber-50 p-6 text-center text-amber-900"
      >
        <AlertTriangle className="size-8" aria-hidden="true" />
        <p className="text-base font-bold">{copy.mapErrorTitle}</p>
        <p className="max-w-md text-sm leading-6 text-amber-900/80">
          {copy.mapErrorBody}
        </p>
        <button
          type="button"
          onClick={this.handleReload}
          className="mt-2 inline-flex items-center justify-center rounded-full border border-amber-400 bg-white px-4 py-2 text-sm font-semibold text-amber-900 shadow-sm transition hover:bg-amber-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2"
        >
          {copy.mapErrorReload}
        </button>
      </div>
    );
  }
}

export default MapErrorBoundary;
