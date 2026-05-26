/**
 * Typed client for the public risk endpoint.
 *
 * Mirrors the backend contract at `GET /api/risk/current`.
 * The two additive fields `single_provider_warning` and `providers` are used
 * by the ensemble confidence chip in the risk card (HFT-62).
 */

import { z } from "zod";

/** Valid freshness states returned by the risk provider summary. */
export const RiskProviderFreshnessStatusValues = [
  "fresh",
  "delayed",
  "stale",
  "partial",
  "failed",
] as const;

export type RiskProviderFreshnessStatus =
  (typeof RiskProviderFreshnessStatusValues)[number];

/** Valid project risk levels. */
export const RiskLevelValues = [
  "green",
  "yellow",
  "orange",
  "red",
] as const;

export type RiskLevel = (typeof RiskLevelValues)[number];

/** Per-provider contribution to the current risk calculation. */
const providerResultSchema = z.object({
  provider: z.string(),
  freshness_status: z.enum(RiskProviderFreshnessStatusValues),
  model_run_time: z.string().nullable().optional(),
  computed_risk_level: z.enum(RiskLevelValues),
  dominant_window: z.string().nullable().optional(),
  frame_count: z.number().int().nonnegative(),
});

/**
 * The subset of `GET /api/risk/current` fields consumed by the UI.
 *
 * Additional backend fields are ignored via `z.object` passthrough-or-strip
 * defaults (strip), keeping the contract additive-safe.
 */
const currentRiskResponseSchema = z.object({
  single_provider_warning: z.boolean(),
  providers: z.array(providerResultSchema),
});

/** One provider's contribution to the ensemble risk. */
export type ProviderResult = z.infer<typeof providerResultSchema>;

/** Parsed response shape from `GET /api/risk/current` (UI-relevant fields). */
export type CurrentRiskResponse = z.infer<typeof currentRiskResponseSchema>;

/** Discriminated error shapes the UI can handle. */
export type RiskApiError =
  | { kind: "network"; message: string; cause?: unknown }
  | { kind: "http"; status: number; message: string; body?: string }
  | { kind: "parse"; message: string; issues: ReadonlyArray<string> }
  | { kind: "aborted"; message: string };

export class RiskApiClientError extends Error {
  readonly detail: RiskApiError;

  constructor(detail: RiskApiError) {
    super(detail.message);
    this.name = "RiskApiClientError";
    this.detail = detail;
  }
}

/** Resolve backend base URL from build-time VITE_API_URL (same pattern as forecastFrames.ts). */
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

/**
 * Fetch the current risk assessment from the backend.
 *
 * Returns only the ensemble-confidence fields needed by the UI chip. The
 * response is parsed with Zod so unexpected shapes surface as parse errors.
 * Throws `RiskApiClientError` for every non-success path.
 */
export async function fetchCurrentRisk(
  signal?: AbortSignal,
): Promise<CurrentRiskResponse> {
  const base = resolveBaseUrl();
  const path = "/api/risk/current";
  const url = base
    ? `${base}${path}`
    : `${window.location.origin}${path}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal,
    });
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new RiskApiClientError({
        kind: "aborted",
        message: "Risk request was aborted before it completed.",
      });
    }
    throw new RiskApiClientError({
      kind: "network",
      message:
        error instanceof Error
          ? `Network error contacting risk API: ${error.message}`
          : "Network error contacting risk API.",
      cause: error,
    });
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new RiskApiClientError({
      kind: "http",
      status: response.status,
      message: `Risk API returned ${response.status} ${response.statusText}`,
      body: body.slice(0, 500),
    });
  }

  let raw: unknown;
  try {
    raw = await response.json();
  } catch (error: unknown) {
    throw new RiskApiClientError({
      kind: "parse",
      message:
        error instanceof Error
          ? `Risk API returned invalid JSON: ${error.message}`
          : "Risk API returned invalid JSON.",
      issues: [],
    });
  }

  const parsed = currentRiskResponseSchema.safeParse(raw);
  if (!parsed.success) {
    throw new RiskApiClientError({
      kind: "parse",
      message: "Risk API response did not match the expected contract.",
      issues: parsed.error.issues.map(
        (issue) => `${issue.path.join(".") || "<root>"}: ${issue.message}`,
      ),
    });
  }

  return parsed.data;
}
