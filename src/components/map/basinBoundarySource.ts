/**
 * Helpers that register the U-Tapao catchment boundary as a MapLibre
 * GeoJSON source and a line layer.
 *
 * The GeoJSON is served from `/data/basin_utapao.geojson` (HydroSHEDS Level 7,
 * WGS84, single-feature Polygon). The layer is always visible — it is not
 * toggled by the `activeLayer` tab control.
 *
 * Keep this module free of React and DOM imports so it stays unit-testable.
 */

import type { Map as MapLibreMap } from "maplibre-gl";

/** Source ID for the basin boundary GeoJSON. */
export const BASIN_BOUNDARY_SOURCE_ID = "hft-basin-boundary-source";
/** Line layer ID for the basin boundary outline. */
export const BASIN_BOUNDARY_LAYER_ID = "hft-basin-boundary-line";

/**
 * Add the basin boundary source and line layer to a MapLibre map instance.
 *
 * Must be called after the map `load` event fires. Safe to call once per map
 * lifetime — callers should not call it again on subsequent renders.
 *
 * Args:
 *   map: Initialised MapLibre map instance with all base sources loaded.
 */
export function addBasinBoundaryLayer(map: MapLibreMap): void {
  map.addSource(BASIN_BOUNDARY_SOURCE_ID, {
    type: "geojson",
    data: "/data/basin_utapao.geojson",
  });

  map.addLayer({
    id: BASIN_BOUNDARY_LAYER_ID,
    type: "line",
    source: BASIN_BOUNDARY_SOURCE_ID,
    paint: {
      "line-color": "#1a73e8",
      "line-width": 1.5,
      "line-opacity": 0.7,
    },
  });
}
