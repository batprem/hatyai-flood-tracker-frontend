import { AlertTriangle, Loader2, RefreshCw, Wifi } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { ForecastFramePicker } from "@/components/forecast/ForecastFramePicker";
import { ForecastFrameMetadata } from "@/components/forecast/ForecastFrameMetadata";
import { FreshnessChip } from "@/components/forecast/FreshnessChip";
import { RainfallFrameLayer } from "@/components/forecast/RainfallFrameLayer";
import type {
  ForecastFrame,
  ForecastFramesError,
  ForecastFreshness,
} from "@/lib/api/forecastFrames";
import {
  type ForecastFramesPhase,
  useForecastFrames,
} from "@/lib/hooks/useForecastFrames";
import {
  type ForecastFramesCopy,
  type Language,
  FORECAST_FRAMES_COPY,
} from "@/lib/i18n/forecastFrames";
import { RISK_LEVEL_STYLES, RiskLevels } from "@/lib/risk/rainfallThresholds";

interface UseRainfallForecastSlotsOptions {
  /** When false, the panel renders muted/disabled. */
  active: boolean;
  language: Language;
  /** Refresh interval in ms; defaults to 5 minutes for live monitoring. */
  refreshIntervalMs?: number;
  /** Optional restriction to a specific provider (e.g. `gfs`). */
  provider?: string;
}

export interface RainfallForecastSlots {
  /** Map overlay (renders inside the map container). */
  overlay: ReactNode;
  /** Sidebar control + metadata for the alert UI. */
  sidebar: ReactNode;
  /** Reusable legend block. */
  legend: ReactNode;
  /** All available forecast frames (sorted by the backend). */
  frames: ReadonlyArray<ForecastFrame>;
  /** Current visible frame (for upstream consumers). */
  visibleFrame: ForecastFrame | null;
  /** Freshness block from the latest successful response. */
  freshness: ForecastFreshness | null;
  /** Current UI lifecycle phase. */
  phase: ForecastFramesPhase;
  /** Whether a request is currently in flight (for spinners/disabled state). */
  isFetching: boolean;
  /** Trigger an explicit refetch (e.g. header refresh or banner retry). */
  refresh: () => void;
}

/**
 * Orchestrate the public rainfall-forecast layer state and return ready-made
 * UI slots so a host page can place the overlay, sidebar, and legend wherever
 * its layout demands.
 */
export function useRainfallForecastSlots({
  active,
  language,
  refreshIntervalMs = 5 * 60 * 1000,
  provider = "gfs",
}: UseRainfallForecastSlotsOptions): RainfallForecastSlots {
  const copy = FORECAST_FRAMES_COPY[language];
  const { phase, data, error, isFetching, refresh } = useForecastFrames({
    provider,
    refreshIntervalMs,
    enabled: active,
  });

  const [selectedFrameId, setSelectedFrameId] = useState<string | null>(null);

  const frames = useMemo<ReadonlyArray<ForecastFrame>>(
    () => data?.frames ?? [],
    [data],
  );

  // Auto-select the first frame on first successful load and when the set of
  // available frames changes.
  useEffect(() => {
    if (frames.length === 0) {
      setSelectedFrameId(null);
      return;
    }
    setSelectedFrameId((current) => {
      if (current && frames.some((frame) => frame.frameId === current)) {
        return current;
      }
      return frames[0].frameId;
    });
  }, [frames]);

  const visibleFrame =
    frames.find((frame) => frame.frameId === selectedFrameId) ?? frames[0] ?? null;
  const freshness = data?.freshness ?? null;
  const isStale = phase === "stale";

  const overlay = (
    <ForecastOverlay
      active={active}
      phase={phase}
      copy={copy}
      visibleFrame={visibleFrame}
      hasFrames={frames.length > 0}
      isStale={isStale}
    />
  );

  const sidebar = (
    <ForecastSidebar
      copy={copy}
      language={language}
      phase={phase}
      error={error}
      isFetching={isFetching}
      visibleFrame={visibleFrame}
      freshness={freshness}
      frames={frames}
      onSelectFrame={setSelectedFrameId}
      onRefresh={refresh}
    />
  );

  const legend = <ForecastRainfallLegend copy={copy} />;

  return {
    overlay,
    sidebar,
    legend,
    frames,
    visibleFrame,
    freshness,
    phase,
    isFetching,
    refresh,
  };
}

interface ForecastOverlayProps {
  active: boolean;
  phase: ForecastFramesPhase;
  copy: ForecastFramesCopy;
  visibleFrame: ForecastFrame | null;
  hasFrames: boolean;
  isStale: boolean;
}

function ForecastOverlay({
  active,
  phase,
  copy,
  visibleFrame,
  hasFrames,
  isStale,
}: ForecastOverlayProps) {
  if (!active) return null;

  if (phase === "loading") {
    return (
      <div
        className="absolute inset-0 flex items-center justify-center"
        role="status"
        aria-live="polite"
      >
        <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white/90 px-4 py-2 text-xs font-bold text-slate-700 shadow">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          {copy.loading}
        </div>
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div
        className="absolute inset-0 flex items-center justify-center"
        role="alert"
      >
        <div className="flex max-w-xs items-center gap-2 rounded-2xl border border-red-200 bg-red-50/95 px-4 py-3 text-xs font-bold text-red-800 shadow-lg">
          <Wifi className="size-4" aria-hidden />
          <span>{copy.errorTitle}</span>
        </div>
      </div>
    );
  }

  if (!hasFrames) {
    return (
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-xs font-bold text-slate-700 shadow">
          {copy.noFrames}
        </div>
      </div>
    );
  }

  if (!visibleFrame) {
    return null;
  }

  return <RainfallFrameLayer frame={visibleFrame} copy={copy} isStale={isStale} />;
}

interface ForecastSidebarProps {
  copy: ForecastFramesCopy;
  language: Language;
  phase: ForecastFramesPhase;
  error: ForecastFramesError | null;
  isFetching: boolean;
  visibleFrame: ForecastFrame | null;
  freshness: ForecastFreshness | null;
  frames: ReadonlyArray<ForecastFrame>;
  onSelectFrame: (frameId: string) => void;
  onRefresh: () => void;
}

function ForecastSidebar({
  copy,
  language,
  phase,
  error,
  isFetching,
  visibleFrame,
  freshness,
  frames,
  onSelectFrame,
  onRefresh,
}: ForecastSidebarProps) {
  return (
    <div className="flex flex-col gap-3" data-testid="forecast-rainfall-sidebar">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <FreshnessChip status={freshness?.status} language={language} copy={copy} />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onRefresh}
          disabled={isFetching}
          className="rounded-full border border-slate-200 px-3 text-xs font-bold text-slate-700"
        >
          <RefreshCw
            className={`size-3.5 ${isFetching ? "animate-spin" : ""}`}
            aria-hidden
          />
          {copy.refresh}
        </Button>
      </div>

      {phase === "stale" ? (
        <div
          className="flex items-start gap-2 rounded-2xl border border-orange-200 bg-orange-50 p-3 text-xs text-orange-900"
          role="status"
        >
          <AlertTriangle className="mt-0.5 size-4" aria-hidden />
          <div>
            <p className="font-bold">{copy.staleBanner}</p>
            <p className="mt-0.5">{copy.staleBannerDetail}</p>
            <p className="mt-1 italic">{copy.showingLastFresh}</p>
          </div>
        </div>
      ) : null}

      {phase === "error" && error ? (
        <div
          className="flex flex-col gap-2 rounded-2xl border border-red-200 bg-red-50 p-3 text-xs text-red-900"
          role="alert"
        >
          <p className="font-bold">{copy.errorTitle}</p>
          <p>{describeError(error, copy)}</p>
          <Button
            type="button"
            size="sm"
            onClick={onRefresh}
            className="self-start rounded-full bg-red-600 text-white hover:bg-red-500"
          >
            {copy.errorRetry}
          </Button>
        </div>
      ) : null}

      {(phase === "success" || phase === "stale") && frames.length > 0 ? (
        <ForecastFramePicker
          frames={frames}
          selectedFrameId={visibleFrame?.frameId ?? null}
          onSelect={onSelectFrame}
          copy={copy}
          language={language}
        />
      ) : null}

      {phase === "success" || phase === "stale" ? (
        <ForecastFrameMetadata
          frame={visibleFrame}
          freshness={freshness}
          copy={copy}
          language={language}
        />
      ) : null}

      {phase === "loading" ? (
        <p className="text-xs text-slate-500">{copy.loadingDetail}</p>
      ) : null}
    </div>
  );
}

function describeError(error: ForecastFramesError, copy: ForecastFramesCopy): string {
  switch (error.kind) {
    case "network":
      return copy.errorNetwork;
    case "http":
      return copy.errorHttp(error.status);
    case "parse":
      return copy.errorParse;
    case "aborted":
      return copy.errorRetry;
  }
}

interface ForecastRainfallLegendProps {
  copy: ForecastFramesCopy;
}

export function ForecastRainfallLegend({ copy }: ForecastRainfallLegendProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white/80 p-3 text-xs">
      <p className="font-bold uppercase tracking-wide text-slate-500">
        {copy.legendTitle}
      </p>
      <ul className="mt-2 grid grid-cols-2 gap-1 sm:grid-cols-4">
        {RiskLevels.map((level) => (
          <li key={level} className="flex items-center gap-1.5">
            <span
              className={`inline-block size-3 rounded-sm ${RISK_LEVEL_STYLES[level].fill}`}
              aria-hidden
            />
            <span className="font-semibold capitalize text-slate-700">{level}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] uppercase tracking-wide text-slate-400">
        {copy.legendUnit}
      </p>
    </div>
  );
}
