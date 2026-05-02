/**
 * Typed client for the public forecast frames endpoint.
 *
 * Mirrors the locked Pydantic contract in
 * `backend/app/schemas/forecast_frames.py`. The shape is provider-agnostic so
 * the public alert UI can render fixture-backed (HFT-5) and real GFS (HFT-11)
 * data through one code path.
 */

import { z } from "zod";

/** Backend-published freshness states for forecast frames. */
export const ForecastFreshnessStatusValues = [
  "fresh",
  "delayed",
  "stale",
  "partial",
  "failed",
] as const;

export type ForecastFreshnessStatus = (typeof ForecastFreshnessStatusValues)[number];

/**
 * Parse an ISO 8601 timestamp into an absolute `Date`, throwing on bad input.
 *
 * The backend returns `Z`-suffixed UTC datetimes; we keep the parsed `Date` so
 * downstream UI helpers can format with `Intl` or compute relative ages.
 */
const isoDateTimeSchema = z
  .string()
  .min(1)
  .transform((value, ctx) => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Expected ISO 8601 datetime, received '${value}'`,
      });
      return z.NEVER;
    }
    return parsed;
  });

const forecastFrameAreaSchema = z.object({
  name: z.string(),
  // [west, south, east, north]
  bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]),
  crs: z.string(),
});

const forecastFrameGridSchema = z.object({
  type: z.string(),
  resolutionDegrees: z.number().positive(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});

const forecastFrameSourceSchema = z.object({
  url: z.string(),
  product: z.string(),
  license: z.string(),
  attribution: z.string(),
  rawArtifactRef: z.string(),
});

const forecastFrameQualitySchema = z.object({
  status: z.string(),
  missingValueCount: z.number().int().nonnegative(),
  min: z.number(),
  max: z.number(),
});

const forecastFrameSchema = z.object({
  frameId: z.string(),
  runId: z.string(),
  provider: z.string(),
  model: z.string(),
  variable: z.string(),
  statistic: z.string(),
  unit: z.string(),
  runTime: isoDateTimeSchema,
  validTime: isoDateTimeSchema,
  windowStart: isoDateTimeSchema,
  windowEnd: isoDateTimeSchema,
  accumulationHours: z.number().int().positive(),
  providerAccumulationSemantics: z.string(),
  forecastHour: z.number().int().nonnegative(),
  retrievedAt: isoDateTimeSchema,
  processedAt: isoDateTimeSchema,
  area: forecastFrameAreaSchema,
  grid: forecastFrameGridSchema,
  valuesMm: z.array(z.number()),
  source: forecastFrameSourceSchema,
  quality: forecastFrameQualitySchema,
});

const forecastFreshnessSchema = z.object({
  status: z.enum(ForecastFreshnessStatusValues),
  retrievedAt: isoDateTimeSchema.nullable().optional(),
  thresholdHours: z.number().int().positive().nullable().optional(),
  provider: z.string().nullable().optional(),
  model: z.string().nullable().optional(),
  runTime: isoDateTimeSchema.nullable().optional(),
  frameCount: z.number().int().nonnegative(),
  reason: z.string().nullable().optional(),
});

const forecastFramesQuerySchema = z.object({
  provider: z.string().nullable().optional(),
  model: z.string().nullable().optional(),
  area: z.string(),
  validTimeFrom: isoDateTimeSchema.nullable().optional(),
  validTimeTo: isoDateTimeSchema.nullable().optional(),
});

const forecastFramesResponseSchema = z.object({
  freshness: forecastFreshnessSchema,
  query: forecastFramesQuerySchema,
  frames: z.array(forecastFrameSchema),
});

/** Geographic area metadata for one forecast frame. */
export type ForecastFrameArea = z.infer<typeof forecastFrameAreaSchema>;

/** Grid description for one clipped frame. */
export type ForecastFrameGrid = z.infer<typeof forecastFrameGridSchema>;

/** Provider provenance preserved on the public contract. */
export type ForecastFrameSource = z.infer<typeof forecastFrameSourceSchema>;

/** Per-frame quality block. */
export type ForecastFrameQuality = z.infer<typeof forecastFrameQualitySchema>;

/** Public, provider-agnostic forecast frame. */
export type ForecastFrame = z.infer<typeof forecastFrameSchema>;

/** Top-level freshness block. */
export type ForecastFreshness = z.infer<typeof forecastFreshnessSchema>;

/** Echoed query parameters from the backend. */
export type ForecastFramesQuery = z.infer<typeof forecastFramesQuerySchema>;

/** Full public response shape. */
export type ForecastFramesResponse = z.infer<typeof forecastFramesResponseSchema>;

/** Inbound query options for the GET endpoint. */
export interface ForecastFramesRequest {
  provider?: string;
  model?: string;
  area?: string;
  validTimeFrom?: Date | string;
  validTimeTo?: Date | string;
  signal?: AbortSignal;
}

/** Discriminated error shapes the UI distinguishes. */
export type ForecastFramesError =
  | { kind: "network"; message: string; cause?: unknown }
  | { kind: "http"; status: number; message: string; body?: string }
  | { kind: "parse"; message: string; issues: ReadonlyArray<string> }
  | { kind: "aborted"; message: string };

export class ForecastFramesApiError extends Error {
  readonly detail: ForecastFramesError;

  constructor(detail: ForecastFramesError) {
    super(detail.message);
    this.name = "ForecastFramesApiError";
    this.detail = detail;
  }
}

/**
 * Resolve the backend base URL from build-time `VITE_API_URL`.
 *
 * Bun replaces literal `process.env.VITE_API_URL` references with their value
 * at build/dev time (allow-listed via `bunfig.toml` and `build.ts`). Falls
 * back to same-origin relative paths so the app still loads if the env var is
 * unset, but in practice deployments must set it.
 */
function resolveBaseUrl(): string {
  const fromEnv = process.env.VITE_API_URL;
  if (typeof fromEnv === "string" && fromEnv.length > 0) {
    return fromEnv.replace(/\/$/, "");
  }
  return "";
}

function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

function buildUrl(path: string, params: Record<string, string | undefined>): string {
  const base = resolveBaseUrl();
  const url = new URL(`${base}${path}`, base ? undefined : window.location.origin);
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string" && value.length > 0) {
      url.searchParams.set(key, value);
    }
  }
  // Strip the synthesized origin if base was empty so we keep a relative URL.
  return base ? url.toString() : `${url.pathname}${url.search}`;
}

/**
 * Fetch normalized forecast frames from the public backend.
 *
 * Throws `ForecastFramesApiError` for every non-success path so callers can
 * branch on `error.detail.kind` in their UI.
 */
export async function fetchForecastFrames(
  request: ForecastFramesRequest = {},
): Promise<ForecastFramesResponse> {
  const url = buildUrl("/api/forecast/frames", {
    provider: request.provider,
    model: request.model,
    area: request.area,
    validTimeFrom: request.validTimeFrom ? toIsoString(request.validTimeFrom) : undefined,
    validTimeTo: request.validTimeTo ? toIsoString(request.validTimeTo) : undefined,
  });

  let response: Response;
  try {
    response = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: request.signal,
    });
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ForecastFramesApiError({
        kind: "aborted",
        message: "Request was aborted before it completed.",
      });
    }
    throw new ForecastFramesApiError({
      kind: "network",
      message:
        error instanceof Error
          ? `Network error contacting forecast API: ${error.message}`
          : "Network error contacting forecast API.",
      cause: error,
    });
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new ForecastFramesApiError({
      kind: "http",
      status: response.status,
      message: `Forecast API returned ${response.status} ${response.statusText}`,
      body: body.slice(0, 500),
    });
  }

  let raw: unknown;
  try {
    raw = await response.json();
  } catch (error: unknown) {
    throw new ForecastFramesApiError({
      kind: "parse",
      message:
        error instanceof Error
          ? `Forecast API returned invalid JSON: ${error.message}`
          : "Forecast API returned invalid JSON.",
      issues: [],
    });
  }

  const parsed = forecastFramesResponseSchema.safeParse(raw);
  if (!parsed.success) {
    throw new ForecastFramesApiError({
      kind: "parse",
      message: "Forecast API response did not match the expected contract.",
      issues: parsed.error.issues.map(
        (issue) => `${issue.path.join(".") || "<root>"}: ${issue.message}`,
      ),
    });
  }

  return parsed.data;
}
