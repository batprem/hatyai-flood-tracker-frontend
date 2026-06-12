/**
 * Typed helper for the research export endpoint (HFT-78).
 *
 * Mirrors the backend contract at `GET /api/export`:
 *   - `dataset`: forecast_frames | risk_history | station_observations
 *   - `format`: csv | geojson
 *   - `start` / `end`: inclusive UTC calendar dates (ISO 8601, YYYY-MM-DD)
 *
 * The endpoint streams a file download (Content-Disposition filename
 * `hft_<dataset>_<start>_<end>.<csv|geojson>`), so the frontend never parses
 * the body — it only builds the URL for a plain anchor navigation. Ranges
 * longer than `MAX_EXPORT_RANGE_DAYS` (inclusive) are rejected by the backend
 * with HTTP 400; the UI mirrors that limit client-side.
 *
 * Base URL resolution follows the same `VITE_API_URL` pattern as
 * `src/lib/api/risk.ts`.
 */

/** Datasets exportable from the backend. */
export const ExportDatasetValues = [
  "forecast_frames",
  "risk_history",
  "station_observations",
] as const;

export type ExportDataset = (typeof ExportDatasetValues)[number];

/** File formats supported by the export endpoint. */
export const ExportFormatValues = ["csv", "geojson"] as const;

export type ExportFormat = (typeof ExportFormatValues)[number];

/** Maximum inclusive calendar-day span accepted by the backend. */
export const MAX_EXPORT_RANGE_DAYS = 92;

function resolveBaseUrl(): string {
  let fromEnv: string | undefined;
  try {
    fromEnv = process.env.VITE_API_URL;
  } catch {
    fromEnv = undefined;
  }
  if (typeof fromEnv === "string" && fromEnv.length > 0) {
    return fromEnv.replace(/\/$/, "");
  }
  return "";
}

/** Validation outcomes for a requested export date range. */
export type ExportRangeValidation =
  | "ok"
  | "missing"
  | "endBeforeStart"
  | "tooLong";

/**
 * Validate an inclusive `YYYY-MM-DD` date range against the export contract.
 *
 * Mirrors the backend rules so the download control can disable itself with
 * a specific message instead of surfacing a raw HTTP 400.
 */
export function validateExportRange(
  start: string,
  end: string,
): ExportRangeValidation {
  if (start === "" || end === "") {
    return "missing";
  }
  const startMs = Date.parse(`${start}T00:00:00Z`);
  const endMs = Date.parse(`${end}T00:00:00Z`);
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
    return "missing";
  }
  if (endMs < startMs) {
    return "endBeforeStart";
  }
  const spanDays = Math.round((endMs - startMs) / 86_400_000) + 1;
  if (spanDays > MAX_EXPORT_RANGE_DAYS) {
    return "tooLong";
  }
  return "ok";
}

/**
 * Build the download URL for `GET /api/export`.
 *
 * Callers should validate the range first via `validateExportRange`; this
 * function only assembles the query string.
 */
export function buildExportUrl(params: {
  dataset: ExportDataset;
  format: ExportFormat;
  start: string;
  end: string;
}): string {
  const base = resolveBaseUrl();
  const origin =
    base !== ""
      ? base
      : typeof window !== "undefined"
        ? window.location.origin
        : "";
  const query = new URLSearchParams({
    dataset: params.dataset,
    format: params.format,
    start: params.start,
    end: params.end,
  });
  return `${origin}/api/export?${query.toString()}`;
}
