/**
 * Pure helpers that register tambon (sub-district) and amphoe (district)
 * administrative boundary layers for the Hat Yai / U-Tapao basin area.
 *
 * Boundaries are served from `/data/admin_hatyai.geojson` — a GeoJSON
 * FeatureCollection derived from OpenStreetMap administrative relations at
 * admin_level 6 (amphoe) and 7 (tambon).
 *
 * Layer z-order intent: admin context lines and labels sit below all data
 * overlays (rainfall fills, risk fills, station pins, shelters) so they never
 * obscure public-safety information. Insert these layers before any fill or
 * symbol layer in the map `load` handler.
 *
 * Keep this module free of React and DOM imports so it stays unit-testable.
 */

import type {
  GeoJSONSourceSpecification,
  LineLayerSpecification,
  SymbolLayerSpecification,
} from "maplibre-gl";

/** Source ID for the admin boundary GeoJSON. */
export const ADMIN_BOUNDARY_SOURCE_ID = "admin-boundary";

/** Line layer ID for tambon (sub-district, admin_level 7) boundaries. */
export const ADMIN_TAMBON_LAYER_ID = "admin-tambon";

/** Line layer ID for amphoe (district, admin_level 6) boundaries. */
export const ADMIN_AMPHOE_LAYER_ID = "admin-amphoe";

/** Symbol layer ID for tambon name labels. */
export const ADMIN_LABEL_LAYER_ID = "admin-label";

/**
 * Return a GeoJSON source specification pointing to the admin boundary file.
 *
 * Returns:
 *   A GeoJSONSourceSpecification for MapLibre addSource calls.
 */
export function buildAdminBoundarySource(): GeoJSONSourceSpecification {
  return {
    type: "geojson",
    data: "/data/admin_hatyai.geojson",
  };
}

/**
 * Return a line layer specification for tambon (sub-district) boundaries.
 *
 * Renders dashed light-slate lines at zoom ≥ 10. The filter restricts
 * rendering to features with admin_level "7" (tambon).
 *
 * Returns:
 *   A LineLayerSpecification for MapLibre addLayer calls.
 */
export function buildAdminTambonLayer(): LineLayerSpecification {
  return {
    id: ADMIN_TAMBON_LAYER_ID,
    type: "line",
    source: ADMIN_BOUNDARY_SOURCE_ID,
    minzoom: 10,
    filter: ["==", ["get", "admin_level"], "7"],
    paint: {
      "line-color": "#94a3b8",
      "line-width": 0.8,
      "line-dasharray": [3, 2],
    },
  };
}

/**
 * Return a line layer specification for amphoe (district) boundaries.
 *
 * Renders solid mid-slate lines at zoom ≥ 9. The filter restricts rendering
 * to features with admin_level "6" (amphoe).
 *
 * Returns:
 *   A LineLayerSpecification for MapLibre addLayer calls.
 */
export function buildAdminAmphoeLayer(): LineLayerSpecification {
  return {
    id: ADMIN_AMPHOE_LAYER_ID,
    type: "line",
    source: ADMIN_BOUNDARY_SOURCE_ID,
    minzoom: 9,
    filter: ["==", ["get", "admin_level"], "6"],
    paint: {
      "line-color": "#475569",
      "line-width": 1.5,
    },
  };
}

/**
 * Return a symbol layer specification for tambon name labels in Thai.
 *
 * Labels appear at zoom ≥ 12, centred on each tambon polygon. The text field
 * uses `coalesce` so Thai name is preferred and English name is the fallback.
 * Text halo keeps labels readable over any basemap or fill colour.
 *
 * Returns:
 *   A SymbolLayerSpecification for MapLibre addLayer calls.
 */
export function buildAdminLabelLayer(): SymbolLayerSpecification {
  return {
    id: ADMIN_LABEL_LAYER_ID,
    type: "symbol",
    source: ADMIN_BOUNDARY_SOURCE_ID,
    minzoom: 12,
    filter: ["==", ["get", "admin_level"], "7"],
    layout: {
      "text-field": ["coalesce", ["get", "name"], ["get", "name_en"]],
      "text-size": 10,
      "text-font": ["Open Sans Regular", "Arial Unicode MS Regular"],
      "text-anchor": "center",
      "text-allow-overlap": false,
    },
    paint: {
      "text-color": "#475569",
      "text-halo-color": "#fff",
      "text-halo-width": 1,
    },
  };
}
