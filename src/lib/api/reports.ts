/**
 * Typed client for the public citizen-reports endpoints (HFT-73 backend).
 *
 * Mirrors the backend contract:
 *   - `POST /api/reports` (multipart/form-data) creates a pending report.
 *   - `GET  /api/reports?limit=` returns approved reports, newest first.
 *
 * The response is snake_case JSON; `location` reuses the same Coordinates shape
 * as the stations/shelters endpoints. The schema is additive-friendly — unknown
 * keys are stripped, never rejected — so the backend can extend the payload
 * without breaking the UI.
 *
 * `photo_url` is ROOT-RELATIVE (`/api/reports/{id}/photo`); resolve it against
 * the API origin with {@link resolveReportPhotoUrl} the same way the rest of the
 * client resolves the API base URL.
 */

import { z } from "zod";

/** Ordered water-depth buckets, shallow -> deep. Order is load-bearing for the map scale. */
export const WaterDepthValues = [
  "ankle",
  "knee",
  "waist",
  "above_waist",
] as const;

export type WaterDepth = (typeof WaterDepthValues)[number];

/** Moderation statuses a report can carry. Public GET only ever returns approved. */
export const ReportStatusValues = [
  "pending",
  "approved",
  "rejected",
] as const;

export type ReportStatus = (typeof ReportStatusValues)[number];

/** Maximum note length accepted by the backend. Enforced client-side too. */
export const REPORT_NOTE_MAX_LENGTH = 500;

/** Coordinates shape shared with the stations/shelters endpoints. */
const coordinatesSchema = z.object({
  longitude: z.number(),
  latitude: z.number(),
});

/**
 * One approved citizen report (UI-facing).
 *
 * `status` is constrained to the known set but defaults to `"pending"` on an
 * unknown future value so a single new enum value does not blank the layer.
 * `photo_url` is root-relative and null when no photo is attached.
 */
const citizenReportSchema = z.object({
  id: z.string(),
  location: coordinatesSchema,
  water_depth: z.enum(WaterDepthValues),
  note: z.string().nullable(),
  status: z.enum(ReportStatusValues).catch("pending"),
  has_photo: z.boolean(),
  photo_url: z.string().nullable(),
  created_at: z.string(),
});

const reportsResponseSchema = z.object({
  reports: z.array(citizenReportSchema),
  count: z.number().int().nonnegative(),
});

/** Response shape from `POST /api/reports` on success (201). */
const submitResponseSchema = z.object({
  id: z.string(),
  status: z.enum(ReportStatusValues).catch("pending"),
  has_photo: z.boolean(),
  created_at: z.string(),
});

/** Parsed approved-report record. */
export type CitizenReport = z.infer<typeof citizenReportSchema>;
/** Parsed `GET /api/reports` response. */
export type ReportsResponse = z.infer<typeof reportsResponseSchema>;
/** Parsed `POST /api/reports` success response. */
export type SubmitReportResponse = z.infer<typeof submitResponseSchema>;

/** Fields a citizen submits when reporting flooding. */
export interface ReportSubmission {
  longitude: number;
  latitude: number;
  waterDepth: WaterDepth;
  /** Optional free-text note, capped at {@link REPORT_NOTE_MAX_LENGTH}. */
  note?: string;
  /** Optional JPEG/image photo captured by the device. */
  photo?: File | null;
}

/**
 * Discriminated error shapes the UI can map to distinct copy. The `http`
 * variant carries the numeric status so the dialog can branch 400/422/429 into
 * bilingual messages.
 */
export type ReportsApiError =
  | { kind: "network"; message: string; cause?: unknown }
  | { kind: "http"; status: number; message: string; body?: string }
  | { kind: "parse"; message: string; issues: ReadonlyArray<string> }
  | { kind: "aborted"; message: string };

export class ReportsApiClientError extends Error {
  readonly detail: ReportsApiError;

  constructor(detail: ReportsApiError) {
    super(detail.message);
    this.name = "ReportsApiClientError";
    this.detail = detail;
  }

  /** Convenience accessor: the HTTP status if this was an `http` error, else null. */
  get httpStatus(): number | null {
    return this.detail.kind === "http" ? this.detail.status : null;
  }
}

/** Resolve backend base URL from build-time VITE_API_URL (same pattern as risk.ts). */
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

/** Resolve the API origin used to prefix root-relative paths. */
function resolveApiOrigin(): string {
  const base = resolveBaseUrl();
  if (base) return base;
  return typeof window !== "undefined" && window.location
    ? window.location.origin
    : "";
}

/**
 * Resolve a root-relative `photo_url` (`/api/reports/{id}/photo`) against the
 * API origin so it loads from the backend rather than the static frontend host.
 *
 * Returns null when no photo URL is present, so callers can skip rendering a
 * broken image. Absolute URLs are passed through unchanged.
 *
 * @param photoUrl - Root-relative or absolute photo URL, or null.
 */
export function resolveReportPhotoUrl(photoUrl: string | null): string | null {
  if (!photoUrl) return null;
  if (/^https?:\/\//i.test(photoUrl)) return photoUrl;
  const origin = resolveApiOrigin();
  const path = photoUrl.startsWith("/") ? photoUrl : `/${photoUrl}`;
  return `${origin}${path}`;
}

/**
 * Fetch approved citizen reports from `GET /api/reports`.
 *
 * Approved-only, newest first. Throws `ReportsApiClientError` on every
 * non-success path so the caller can render a real error state rather than an
 * empty map that implies "no flooding reported".
 *
 * @param limit - Optional maximum number of reports to request.
 * @param signal - Optional abort signal to cancel the request on unmount.
 */
export async function fetchApprovedReports(
  limit?: number,
  signal?: AbortSignal,
): Promise<ReportsResponse> {
  const base = resolveBaseUrl();
  const query =
    typeof limit === "number" && Number.isFinite(limit)
      ? `?limit=${encodeURIComponent(String(Math.trunc(limit)))}`
      : "";
  const path = `/api/reports${query}`;
  const url = base ? `${base}${path}` : `${resolveApiOrigin()}${path}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal,
    });
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ReportsApiClientError({
        kind: "aborted",
        message: "Reports request was aborted before it completed.",
      });
    }
    throw new ReportsApiClientError({
      kind: "network",
      message:
        error instanceof Error
          ? `Network error contacting reports API: ${error.message}`
          : "Network error contacting reports API.",
      cause: error,
    });
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new ReportsApiClientError({
      kind: "http",
      status: response.status,
      message: `Reports API returned ${response.status} ${response.statusText}`,
      body: body.slice(0, 500),
    });
  }

  let raw: unknown;
  try {
    raw = await response.json();
  } catch (error: unknown) {
    throw new ReportsApiClientError({
      kind: "parse",
      message:
        error instanceof Error
          ? `Reports API returned invalid JSON: ${error.message}`
          : "Reports API returned invalid JSON.",
      issues: [],
    });
  }

  const parsed = reportsResponseSchema.safeParse(raw);
  if (!parsed.success) {
    throw new ReportsApiClientError({
      kind: "parse",
      message: "Reports API response did not match the expected contract.",
      issues: parsed.error.issues.map(
        (issue) => `${issue.path.join(".") || "<root>"}: ${issue.message}`,
      ),
    });
  }

  return parsed.data;
}

/**
 * Submit a new citizen flood report to `POST /api/reports`.
 *
 * Always sends `multipart/form-data` so a single code path covers both the
 * photo and no-photo cases (the backend accepts multipart in both). The browser
 * sets the multipart boundary, so no explicit Content-Type header is set.
 *
 * Throws `ReportsApiClientError` on every non-success path. The `http` variant
 * carries the status so the caller can map 400 (outside basin / invalid photo),
 * 422 (bad fields), and 429 (rate limit) to distinct bilingual copy.
 *
 * @param submission - The citizen-entered report fields.
 * @param signal - Optional abort signal to cancel the request.
 */
export async function submitReport(
  submission: ReportSubmission,
  signal?: AbortSignal,
): Promise<SubmitReportResponse> {
  const base = resolveBaseUrl();
  const path = "/api/reports";
  const url = base ? `${base}${path}` : `${resolveApiOrigin()}${path}`;

  const form = new FormData();
  form.set("longitude", String(submission.longitude));
  form.set("latitude", String(submission.latitude));
  form.set("water_depth", submission.waterDepth);
  const note = submission.note?.trim();
  if (note) {
    form.set("note", note.slice(0, REPORT_NOTE_MAX_LENGTH));
  }
  if (submission.photo) {
    form.set("photo", submission.photo, submission.photo.name);
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { Accept: "application/json" },
      body: form,
      signal,
    });
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ReportsApiClientError({
        kind: "aborted",
        message: "Report submission was aborted before it completed.",
      });
    }
    throw new ReportsApiClientError({
      kind: "network",
      message:
        error instanceof Error
          ? `Network error submitting report: ${error.message}`
          : "Network error submitting report.",
      cause: error,
    });
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new ReportsApiClientError({
      kind: "http",
      status: response.status,
      message: `Reports API returned ${response.status} ${response.statusText}`,
      body: body.slice(0, 500),
    });
  }

  let raw: unknown;
  try {
    raw = await response.json();
  } catch (error: unknown) {
    throw new ReportsApiClientError({
      kind: "parse",
      message:
        error instanceof Error
          ? `Reports API returned invalid JSON: ${error.message}`
          : "Reports API returned invalid JSON.",
      issues: [],
    });
  }

  const parsed = submitResponseSchema.safeParse(raw);
  if (!parsed.success) {
    throw new ReportsApiClientError({
      kind: "parse",
      message: "Report submission response did not match the expected contract.",
      issues: parsed.error.issues.map(
        (issue) => `${issue.path.join(".") || "<root>"}: ${issue.message}`,
      ),
    });
  }

  return parsed.data;
}
