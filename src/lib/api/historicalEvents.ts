/**
 * Typed client for the public historical events endpoint.
 *
 * Mirrors the backend contract at `GET /api/events/historical`.
 * Uses the same fetch/parse pattern as `forecastFrames.ts` (HFT-17).
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const riskLevelSchema = z.enum(["green", "yellow", "orange", "red"]);

const perWindowRiskSchema = z.object({
  window_24h: riskLevelSchema,
  window_48h: riskLevelSchema,
  window_72h: riskLevelSchema,
});

const historicalEventSchema = z.object({
  event_id: z.string(),
  event_date: z.string(),
  event_name_en: z.string(),
  event_name_th: z.string(),
  accumulated_24h_mm: z.number(),
  accumulated_48h_mm: z.number(),
  accumulated_72h_mm: z.number(),
  flooded: z.boolean(),
  rule_output: riskLevelSchema,
  per_window_risk: perWindowRiskSchema,
  source_citation: z.string(),
  narrative_en: z.string(),
  narrative_th: z.string(),
  threshold_adjustments_made: z.boolean(),
  threshold_adjustment_note_en: z.string().nullable().optional(),
  threshold_adjustment_note_th: z.string().nullable().optional(),
});

const historicalEventsResponseSchema = z.object({
  events: z.array(historicalEventSchema),
  data_note: z.string(),
  event_count: z.number().int().nonnegative(),
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Risk level used by the historical events endpoint. */
export type HistoricalEventRiskLevel = z.infer<typeof riskLevelSchema>;

/** Per-window risk breakdown. */
export type HistoricalEventPerWindowRisk = z.infer<typeof perWindowRiskSchema>;

/** A single historical flood event record. */
export type HistoricalEvent = z.infer<typeof historicalEventSchema>;

/** Full response from `GET /api/events/historical`. */
export type HistoricalEventsResponse = z.infer<typeof historicalEventsResponseSchema>;

// ---------------------------------------------------------------------------
// Error types (mirror forecastFrames pattern)
// ---------------------------------------------------------------------------

/** Discriminated error shapes the UI distinguishes. */
export type HistoricalEventsError =
  | { kind: "network"; message: string; cause?: unknown }
  | { kind: "http"; status: number; message: string; body?: string }
  | { kind: "parse"; message: string; issues: ReadonlyArray<string> }
  | { kind: "aborted"; message: string };

export class HistoricalEventsApiError extends Error {
  readonly detail: HistoricalEventsError;

  constructor(detail: HistoricalEventsError) {
    super(detail.message);
    this.name = "HistoricalEventsApiError";
    this.detail = detail;
  }
}

// ---------------------------------------------------------------------------
// Helpers (mirrored from forecastFrames.ts)
// ---------------------------------------------------------------------------

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

function buildUrl(path: string): string {
  const base = resolveBaseUrl();
  const url = new URL(
    `${base}${path}`,
    base ? undefined : window.location.origin,
  );
  return base ? url.toString() : `${url.pathname}${url.search}`;
}

// ---------------------------------------------------------------------------
// Public fetch function
// ---------------------------------------------------------------------------

/**
 * Fetch historical flood events from the public backend.
 *
 * Throws `HistoricalEventsApiError` for every non-success path so callers can
 * branch on `error.detail.kind` in their UI.
 *
 * Args:
 *   signal: Optional abort signal to cancel the request.
 *
 * Returns:
 *   Parsed and validated historical events response.
 */
export async function fetchHistoricalEvents(
  signal?: AbortSignal,
): Promise<HistoricalEventsResponse> {
  const url = buildUrl("/api/events/historical");

  let response: Response;
  try {
    response = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal,
    });
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new HistoricalEventsApiError({
        kind: "aborted",
        message: "Request was aborted before it completed.",
      });
    }
    throw new HistoricalEventsApiError({
      kind: "network",
      message:
        error instanceof Error
          ? `Network error contacting events API: ${error.message}`
          : "Network error contacting events API.",
      cause: error,
    });
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new HistoricalEventsApiError({
      kind: "http",
      status: response.status,
      message: `Events API returned ${response.status} ${response.statusText}`,
      body: body.slice(0, 500),
    });
  }

  let raw: unknown;
  try {
    raw = await response.json();
  } catch (error: unknown) {
    throw new HistoricalEventsApiError({
      kind: "parse",
      message:
        error instanceof Error
          ? `Events API returned invalid JSON: ${error.message}`
          : "Events API returned invalid JSON.",
      issues: [],
    });
  }

  const parsed = historicalEventsResponseSchema.safeParse(raw);
  if (!parsed.success) {
    throw new HistoricalEventsApiError({
      kind: "parse",
      message: "Events API response did not match the expected contract.",
      issues: parsed.error.issues.map(
        (issue) => `${issue.path.join(".") || "<root>"}: ${issue.message}`,
      ),
    });
  }

  return parsed.data;
}
