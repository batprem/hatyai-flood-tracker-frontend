/**
 * React hook that wraps the forecast frames API with explicit lifecycle states.
 *
 * The hook keeps the last successful response so the UI can show stale data
 * with a clear stale indicator instead of going blank when the backend fails
 * (per Phase 1 public-safety UX requirements).
 */

import { useCallback, useEffect, useRef, useState } from "react";

import {
  type ForecastFramesError,
  type ForecastFramesRequest,
  type ForecastFramesResponse,
  ForecastFramesApiError,
  fetchForecastFrames,
} from "@/lib/api/forecastFrames";

/** UI-facing lifecycle phases for the forecast frames request. */
export type ForecastFramesPhase = "idle" | "loading" | "success" | "stale" | "error";

export interface UseForecastFramesState {
  /** Current high-level UI phase. `stale` means a previous good response is still displayed. */
  phase: ForecastFramesPhase;
  /** Most recent successful response, if any. */
  data: ForecastFramesResponse | null;
  /** Most recent error, if the latest request failed. Cleared on success. */
  error: ForecastFramesError | null;
  /** Whether a request is currently in flight. */
  isFetching: boolean;
  /** Trigger an explicit refetch from the UI (e.g. retry button). */
  refresh: () => void;
}

interface UseForecastFramesOptions extends ForecastFramesRequest {
  /** Optional auto-refresh interval. Defaults to no auto refresh. */
  refreshIntervalMs?: number;
  /** Skip the request entirely (e.g. waiting on user input). */
  enabled?: boolean;
}

/**
 * Manage the lifecycle of a `GET /api/forecast/frames` request.
 *
 * - Returns `loading` on first fetch, `success` after a successful response.
 * - On a subsequent failure while `data` is non-null, returns `stale` and
 *   keeps the last good response visible.
 * - On a failure with no prior data, returns `error`.
 */
export function useForecastFrames(
  options: UseForecastFramesOptions = {},
): UseForecastFramesState {
  const {
    refreshIntervalMs,
    enabled = true,
    provider,
    model,
    area,
    validTimeFrom,
    validTimeTo,
  } = options;

  const [data, setData] = useState<ForecastFramesResponse | null>(null);
  const [error, setError] = useState<ForecastFramesError | null>(null);
  const [phase, setPhase] = useState<ForecastFramesPhase>("idle");
  const [isFetching, setIsFetching] = useState(false);
  const [requestKey, setRequestKey] = useState(0);

  const abortRef = useRef<AbortController | null>(null);
  const dataRef = useRef<ForecastFramesResponse | null>(null);
  dataRef.current = data;

  const refresh = useCallback(() => {
    setRequestKey((current) => current + 1);
  }, []);

  useEffect(() => {
    if (!enabled) {
      setPhase("idle");
      return;
    }

    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;

    setIsFetching(true);
    if (dataRef.current === null) {
      setPhase("loading");
    }

    fetchForecastFrames({
      provider,
      model,
      area,
      validTimeFrom,
      validTimeTo,
      signal: controller.signal,
    })
      .then((response) => {
        if (controller.signal.aborted) return;
        setData(response);
        setError(null);
        setPhase("success");
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        const detail = toErrorDetail(err);
        if (detail.kind === "aborted") return;
        setError(detail);
        setPhase(dataRef.current ? "stale" : "error");
      })
      .finally(() => {
        if (controller.signal.aborted) return;
        setIsFetching(false);
      });

    return () => {
      controller.abort();
    };
  }, [enabled, provider, model, area, validTimeFrom, validTimeTo, requestKey]);

  useEffect(() => {
    if (!enabled || !refreshIntervalMs || refreshIntervalMs <= 0) return;
    const interval = window.setInterval(() => {
      setRequestKey((current) => current + 1);
    }, refreshIntervalMs);
    return () => {
      window.clearInterval(interval);
    };
  }, [enabled, refreshIntervalMs]);

  return { phase, data, error, isFetching, refresh };
}

function toErrorDetail(error: unknown): ForecastFramesError {
  if (error instanceof ForecastFramesApiError) {
    return error.detail;
  }
  if (error instanceof DOMException && error.name === "AbortError") {
    return { kind: "aborted", message: "Request aborted." };
  }
  if (error instanceof Error) {
    return { kind: "network", message: error.message, cause: error };
  }
  return { kind: "network", message: "Unknown error contacting forecast API." };
}
