/**
 * Typed client for the public shelters endpoint.
 *
 * Mirrors the backend contract at `GET /api/shelters` (HFT-71). The response is
 * snake_case JSON; `location` reuses the same Coordinates shape as the stations
 * endpoint. The schema is additive-friendly — unknown keys are stripped, never
 * rejected — so the backend can extend the payload without breaking the UI.
 */

import { z } from "zod";

/** Shelter facility categories published by the backend. */
export const ShelterTypeValues = [
  "school",
  "university",
  "temple",
  "community_center",
  "other",
] as const;

export type ShelterType = (typeof ShelterTypeValues)[number];

/**
 * Coordinates shape shared with the stations endpoint.
 *
 * latitude/longitude are load-bearing for distance math and map placement, so a
 * malformed coordinate must surface as a parse error rather than silently
 * defaulting.
 */
const coordinatesSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
});

/**
 * One shelter record. `type` falls back to `"other"` on an unknown future
 * category so a single new enum value does not blank the whole layer —
 * public-safety data should degrade gracefully.
 */
const shelterSchema = z.object({
  id: z.string(),
  name_th: z.string(),
  name_en: z.string(),
  type: z.enum(ShelterTypeValues).catch("other"),
  location: coordinatesSchema,
  municipality_th: z.string(),
  capacity: z.number().nullable(),
  source: z.string(),
  source_url: z.string(),
  coordinate_source: z.string(),
  coordinate_source_url: z.string(),
});

/** Dataset-level provenance returned alongside the shelter list. */
const provenanceSchema = z.object({
  license: z.string(),
  retrieved_date: z.string(),
  dataset_ref: z.string(),
  accuracy_note: z.string(),
});

const sheltersResponseSchema = z.object({
  shelters: z.array(shelterSchema),
  shelter_count: z.number().int().nonnegative(),
  provenance: provenanceSchema,
});

/** Parsed shelter record (UI-facing). */
export type Shelter = z.infer<typeof shelterSchema>;
/** Dataset provenance block. */
export type ShelterProvenance = z.infer<typeof provenanceSchema>;
/** Parsed response shape from `GET /api/shelters`. */
export type SheltersResponse = z.infer<typeof sheltersResponseSchema>;

/** Discriminated error shapes the UI can handle. */
export type SheltersApiError =
  | { kind: "network"; message: string; cause?: unknown }
  | { kind: "http"; status: number; message: string; body?: string }
  | { kind: "parse"; message: string; issues: ReadonlyArray<string> }
  | { kind: "aborted"; message: string };

export class SheltersApiClientError extends Error {
  readonly detail: SheltersApiError;

  constructor(detail: SheltersApiError) {
    super(detail.message);
    this.name = "SheltersApiClientError";
    this.detail = detail;
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

/** Static fallback path: the committed dataset served by the dev/static host. */
const STATIC_GEOJSON_PATH = "/data/shelters_hatyai.geojson";

/**
 * Fetch the typed shelter directory from the backend at `GET /api/shelters`.
 *
 * Throws `SheltersApiClientError` on every non-success path so the caller can
 * decide whether to fall back to the static dataset.
 *
 * @param signal - Optional abort signal to cancel the request on unmount.
 */
async function fetchSheltersFromApi(
  signal?: AbortSignal,
): Promise<SheltersResponse> {
  const base = resolveBaseUrl();
  const path = "/api/shelters";
  const url = base ? `${base}${path}` : `${window.location.origin}${path}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal,
    });
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new SheltersApiClientError({
        kind: "aborted",
        message: "Shelters request was aborted before it completed.",
      });
    }
    throw new SheltersApiClientError({
      kind: "network",
      message:
        error instanceof Error
          ? `Network error contacting shelters API: ${error.message}`
          : "Network error contacting shelters API.",
      cause: error,
    });
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new SheltersApiClientError({
      kind: "http",
      status: response.status,
      message: `Shelters API returned ${response.status} ${response.statusText}`,
      body: body.slice(0, 500),
    });
  }

  let raw: unknown;
  try {
    raw = await response.json();
  } catch (error: unknown) {
    throw new SheltersApiClientError({
      kind: "parse",
      message:
        error instanceof Error
          ? `Shelters API returned invalid JSON: ${error.message}`
          : "Shelters API returned invalid JSON.",
      issues: [],
    });
  }

  const parsed = sheltersResponseSchema.safeParse(raw);
  if (!parsed.success) {
    throw new SheltersApiClientError({
      kind: "parse",
      message: "Shelters API response did not match the expected contract.",
      issues: parsed.error.issues.map(
        (issue) => `${issue.path.join(".") || "<root>"}: ${issue.message}`,
      ),
    });
  }

  return parsed.data;
}

/** Minimal shape we read out of the static GeoJSON feature properties. */
const geojsonFeatureSchema = z.object({
  properties: z.object({
    name_th: z.string(),
    name_en: z.string(),
    type: z.enum(ShelterTypeValues).catch("other"),
    municipality_th: z.string(),
    capacity: z.number().nullable().catch(null),
    source: z.string().catch(""),
    source_url: z.string().catch(""),
    coordinate_source: z.string().catch(""),
    coordinate_source_url: z.string().catch(""),
  }),
  geometry: z.object({
    type: z.literal("Point"),
    coordinates: z.tuple([z.number(), z.number()]),
  }),
});

const geojsonSchema = z.object({
  license: z.string().catch(""),
  retrieved_date: z.string().catch(""),
  accuracy_note: z.string().catch(""),
  features: z.array(geojsonFeatureSchema),
});

/**
 * Derive a stable, React-key-safe id from an OSM coordinate reference such as
 * `OpenStreetMap way/858854620` -> `way-858854620`. Falls back to a slug of the
 * English name when no OSM ref is present.
 */
function deriveShelterId(coordinateSource: string, nameEn: string): string {
  const match = coordinateSource.match(/(node|way|relation)\/(\d+)/);
  if (match) {
    return `${match[1]}-${match[2]}`;
  }
  return nameEn
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
}

/**
 * Load the committed static shelter GeoJSON and adapt it to the API contract.
 *
 * This keeps the shelter layer functional in dev/preview where the backend is
 * not wired (no `VITE_API_URL`). Public-safety data should render whenever the
 * dataset is available rather than fail to an empty map.
 *
 * @param signal - Optional abort signal to cancel the request on unmount.
 */
async function fetchSheltersFromStatic(
  signal?: AbortSignal,
): Promise<SheltersResponse> {
  // Resolve against the document origin so non-browser fetch impls (and tests)
  // can load it; in the browser this is equivalent to a root-relative path.
  const origin =
    typeof window !== "undefined" && window.location
      ? window.location.origin
      : "";
  const staticUrl = `${origin}${STATIC_GEOJSON_PATH}`;

  let response: Response;
  try {
    response = await fetch(staticUrl, {
      headers: { Accept: "application/geo+json, application/json" },
      signal,
    });
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new SheltersApiClientError({
        kind: "aborted",
        message: "Shelters request was aborted before it completed.",
      });
    }
    throw new SheltersApiClientError({
      kind: "network",
      message: "Could not load the static shelter dataset.",
      cause: error,
    });
  }
  if (!response.ok) {
    throw new SheltersApiClientError({
      kind: "http",
      status: response.status,
      message: `Static shelter dataset returned ${response.status}.`,
    });
  }

  const raw: unknown = await response.json().catch(() => null);
  const parsed = geojsonSchema.safeParse(raw);
  if (!parsed.success) {
    throw new SheltersApiClientError({
      kind: "parse",
      message: "Static shelter dataset did not match the expected GeoJSON shape.",
      issues: parsed.error.issues.map(
        (issue) => `${issue.path.join(".") || "<root>"}: ${issue.message}`,
      ),
    });
  }

  const shelters: Shelter[] = parsed.data.features.map((feature) => {
    const props = feature.properties;
    const [longitude, latitude] = feature.geometry.coordinates;
    return {
      id: deriveShelterId(props.coordinate_source, props.name_en),
      name_th: props.name_th,
      name_en: props.name_en,
      type: props.type,
      location: { latitude, longitude },
      municipality_th: props.municipality_th,
      capacity: props.capacity,
      source: props.source,
      source_url: props.source_url,
      coordinate_source: props.coordinate_source,
      coordinate_source_url: props.coordinate_source_url,
    };
  });

  return {
    shelters,
    shelter_count: shelters.length,
    provenance: {
      license: parsed.data.license,
      retrieved_date: parsed.data.retrieved_date,
      dataset_ref: STATIC_GEOJSON_PATH,
      accuracy_note: parsed.data.accuracy_note,
    },
  };
}

/**
 * Fetch the public shelter directory.
 *
 * Prefers the live typed API (`GET /api/shelters`); if that fails for any
 * non-abort reason it falls back to the committed static GeoJSON so the map
 * layer and nearest-shelter guidance still render in environments where the
 * backend is not reachable (dev, Vercel preview without `VITE_API_URL`). Aborts
 * propagate unchanged so unmount cancellation stays clean. If both the API and
 * the static dataset fail, the original API error is thrown so the UI shows a
 * real error state rather than implying there are no shelters.
 *
 * @param signal - Optional abort signal to cancel the request on unmount.
 */
export async function fetchShelters(
  signal?: AbortSignal,
): Promise<SheltersResponse> {
  try {
    return await fetchSheltersFromApi(signal);
  } catch (apiError: unknown) {
    if (
      apiError instanceof SheltersApiClientError &&
      apiError.detail.kind === "aborted"
    ) {
      throw apiError;
    }
    try {
      return await fetchSheltersFromStatic(signal);
    } catch (staticError: unknown) {
      if (
        staticError instanceof SheltersApiClientError &&
        staticError.detail.kind === "aborted"
      ) {
        throw staticError;
      }
      // Surface the original API failure as the canonical error.
      throw apiError;
    }
  }
}

/**
 * Great-circle distance between two WGS84 points in kilometres (Haversine).
 *
 * Accurate enough for "nearest few" guidance at city scale; this is not a
 * routing distance.
 *
 * @param a - Origin `[longitude, latitude]`.
 * @param b - Destination `[longitude, latitude]`.
 */
export function haversineKm(
  a: readonly [number, number],
  b: readonly [number, number],
): number {
  const EARTH_RADIUS_KM = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const [lng1, lat1] = a;
  const [lng2, lat2] = b;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * sinLng * sinLng;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** A shelter paired with its computed distance from an origin point. */
export interface ShelterWithDistance {
  shelter: Shelter;
  distanceKm: number;
}

/**
 * Rank shelters by distance from an origin and return the nearest `limit`.
 *
 * @param shelters - Full shelter list from the API.
 * @param origin - Reference point as `[longitude, latitude]`.
 * @param limit - Maximum number of shelters to return. Defaults to `3`.
 */
export function nearestShelters(
  shelters: ReadonlyArray<Shelter>,
  origin: readonly [number, number],
  limit = 3,
): ShelterWithDistance[] {
  return shelters
    .map((shelter) => ({
      shelter,
      distanceKm: haversineKm(origin, [
        shelter.location.longitude,
        shelter.location.latitude,
      ]),
    }))
    .sort((x, y) => x.distanceKm - y.distanceKm)
    .slice(0, limit);
}
