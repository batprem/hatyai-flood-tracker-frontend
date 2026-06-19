/**
 * Helpers that register the U-Tapao river and canal network as MapLibre
 * GeoJSON sources and layers.
 *
 * The GeoJSON is served from `/data/rivers_utapao.geojson` (OpenStreetMap
 * waterways queried via Overpass API, WGS84, FeatureCollection of LineString
 * features). Two layers are added: a line layer for the waterway geometry and
 * a symbol layer for Thai/English name labels that follow the line path.
 *
 * Both layers are always visible — they are not toggled by the `activeLayer`
 * tab control on the dashboard.
 *
 * Keep this module free of React and DOM imports so it stays unit-testable.
 */

import type {
  GeoJSONSourceSpecification,
  LineLayerSpecification,
  SymbolLayerSpecification,
} from "maplibre-gl";

/** Source ID for the rivers/canals GeoJSON. */
export const RIVERS_SOURCE_ID = "rivers";
/** Line layer ID for waterway geometry. */
export const RIVERS_LINE_LAYER_ID = "rivers-line";
/** Symbol layer ID for waterway name labels. */
export const RIVERS_LABEL_LAYER_ID = "rivers-label";

/**
 * Build the MapLibre GeoJSON source specification for the river network.
 *
 * Returns a source spec pointing to the static GeoJSON file served from
 * the public directory.
 */
export function buildRiversSource(): GeoJSONSourceSpecification {
  return {
    type: "geojson",
    data: "/data/rivers_utapao.geojson",
  };
}

/**
 * Build the line layer specification for the waterway geometry.
 *
 * Line colour and width vary by waterway type (river, canal, stream) using
 * MapLibre match expressions. Opacity is fixed at 0.85 to keep the layer
 * readable over diverse basemap styles. The layer is visible from zoom 8.
 */
export function buildRiversLineLayer(): LineLayerSpecification {
  return {
    id: RIVERS_LINE_LAYER_ID,
    type: "line",
    source: RIVERS_SOURCE_ID,
    minzoom: 8,
    layout: {
      "line-cap": "round",
      "line-join": "round",
    },
    paint: {
      "line-color": [
        "match",
        ["get", "waterway"],
        "river", "#4a9eca",
        "canal", "#6ab4e8",
        "#90caf9",
      ],
      "line-width": [
        "interpolate",
        ["linear"],
        ["zoom"],
        9,
        [
          "match",
          ["get", "waterway"],
          "river", 2,
          "canal", 1.5,
          0.8,
        ],
        13,
        [
          "match",
          ["get", "waterway"],
          "river", 4,
          "canal", 3,
          1.5,
        ],
      ],
      "line-opacity": 0.85,
    },
  };
}

/**
 * Build the symbol layer specification for waterway name labels.
 *
 * Labels follow the line geometry and prefer the Thai `name` property,
 * falling back to the English `name_en` property. The layer is only visible
 * from zoom 11 to avoid cluttering lower zoom levels.
 */
export function buildRiversLabelLayer(): SymbolLayerSpecification {
  return {
    id: RIVERS_LABEL_LAYER_ID,
    type: "symbol",
    source: RIVERS_SOURCE_ID,
    minzoom: 11,
    layout: {
      "symbol-placement": "line",
      "text-field": [
        "coalesce",
        ["get", "name"],
        ["get", "name_en"],
        "",
      ],
      "text-size": 11,
      "text-font": ["Open Sans Regular", "Arial Unicode MS Regular"],
    },
    paint: {
      "text-color": "#1565c0",
      "text-halo-color": "#ffffff",
      "text-halo-width": 1.5,
    },
  };
}
