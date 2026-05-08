/**
 * Shared basin/area constants for the dashboard MapLibre view.
 *
 * Mirrors the conservative Phase 1 bounding box documented in
 * `docs/data-sources.md:21`. Keep this file as the single source of truth so
 * the map, rainfall layer, and station overlay all clip to the same region.
 */

/** Bounding box tuple shape used by GeoJSON, MapLibre, and the API contract. */
export type Bbox = readonly [west: number, south: number, east: number, north: number];

/**
 * Hat Yai / U-Tapao canal / Songkhla Lake Phase 1 bounding box.
 *
 * Order is `[west, south, east, north]` to match the API contract in
 * `frontend/src/lib/api/forecastFrames.ts`.
 */
export const BASIN_BBOX: Bbox = [100.15, 6.55, 100.95, 7.35];

/** Center of {@link BASIN_BBOX}, expressed as `[lng, lat]` for MapLibre. */
export const BASIN_CENTER: readonly [number, number] = [
  (BASIN_BBOX[0] + BASIN_BBOX[2]) / 2,
  (BASIN_BBOX[1] + BASIN_BBOX[3]) / 2,
];

/**
 * MapLibre `LngLatBoundsLike` for the basin, expressed as the `[[w, s], [e, n]]`
 * tuple shape that `Map#fitBounds` accepts without conversion.
 */
export const BASIN_BOUNDS: readonly [
  readonly [number, number],
  readonly [number, number],
] = [
  [BASIN_BBOX[0], BASIN_BBOX[1]],
  [BASIN_BBOX[2], BASIN_BBOX[3]],
];

/** Default zoom used when the basin is centered without an explicit fit. */
export const BASIN_DEFAULT_ZOOM = 9.5;
