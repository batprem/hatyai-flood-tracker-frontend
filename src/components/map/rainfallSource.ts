/**
 * Pure helpers that turn a typed `ForecastFrame` into MapLibre source/layer
 * specs for the dashboard rainfall layer.
 *
 * Keep this module free of React and DOM imports so it stays unit-testable and
 * shareable across map screens.
 */

import type {
  FillLayerSpecification,
  GeoJSONSourceSpecification,
  HeatmapLayerSpecification,
  LineLayerSpecification,
} from "maplibre-gl";
import type { Feature, FeatureCollection, Point, Polygon } from "geojson";

import type { ForecastFrame } from "@/lib/api/forecastFrames";
import {
  type RiskLevel,
  classifyRainfallMm,
} from "@/lib/risk/rainfallThresholds";

/** Source ID for the rainfall grid GeoJSON. */
export const RAINFALL_SOURCE_ID = "hft-rainfall-source";
/** Fill layer ID rendered above the basemap when the rainfall layer is active. */
export const RAINFALL_FILL_LAYER_ID = "hft-rainfall-fill";
/** Outline layer ID, drawn on top of the fill for cell separation. */
export const RAINFALL_OUTLINE_LAYER_ID = "hft-rainfall-outline";
/** Heatmap layer ID that replaces the fill/outline layers for smooth interpolation. */
export const RAINFALL_HEATMAP_LAYER_ID = "rainfall-heatmap";

/** Per-cell GeoJSON properties exposed to MapLibre style expressions. */
export interface RainfallCellProperties {
  cellIndex: number;
  rainMm: number;
  riskLevel: RiskLevel;
  accumulationHours: number;
  validTime: string;
  forecastHour: number;
}

/** Per-cell point properties for the heatmap layer. Extends cell properties with a numeric weight. */
export interface RainfallPointProperties extends RainfallCellProperties {
  /** Numeric weight mapped from riskLevel: green→1, yellow→2, orange→3, red→4. */
  intensity: number;
}

/** Type-safe alias for the rainfall grid feature collection. */
export type RainfallCellCollection = FeatureCollection<Polygon, RainfallCellProperties>;

/** Type-safe alias for the rainfall point feature collection used by the heatmap layer. */
export type RainfallPointCollection = FeatureCollection<Point, RainfallPointProperties>;

/** Maps a risk level string to a numeric intensity weight for the heatmap. */
const RISK_INTENSITY: Record<RiskLevel, number> = {
  green: 1,
  yellow: 2,
  orange: 3,
  red: 4,
};

/**
 * Build a GeoJSON FeatureCollection with one Polygon per rainfall grid cell.
 *
 * Cells are positioned using the frame's bbox (EPSG:4326 per the contract) and
 * row-major `valuesMm` array (length = `width * height`). When the array is
 * shorter than expected we pad with `0` so the map still renders something
 * reasonable instead of crashing.
 */
export function buildRainfallFeatureCollection(
  frame: ForecastFrame | null,
): RainfallCellCollection {
  if (!frame) {
    return { type: "FeatureCollection", features: [] };
  }

  const {
    grid,
    valuesMm,
    accumulationHours,
    area: { bbox },
  } = frame;
  const [west, south, east, north] = bbox;
  const cellLng = (east - west) / grid.width;
  const cellLat = (north - south) / grid.height;
  const expected = grid.width * grid.height;
  const validTimeIso = frame.validTime.toISOString();

  const features: Feature<Polygon, RainfallCellProperties>[] = [];
  for (let row = 0; row < grid.height; row += 1) {
    for (let col = 0; col < grid.width; col += 1) {
      const index = row * grid.width + col;
      if (index >= expected) break;
      const rainMm = Number.isFinite(valuesMm[index]) ? valuesMm[index] : 0;
      // Conventional row 0 is the *northern* row in geographic raster grids,
      // so flip when computing the polygon's south/north edges.
      const cellNorth = north - row * cellLat;
      const cellSouth = cellNorth - cellLat;
      const cellWest = west + col * cellLng;
      const cellEast = cellWest + cellLng;
      const level = classifyRainfallMm(rainMm, accumulationHours);
      features.push({
        type: "Feature",
        id: index,
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [cellWest, cellSouth],
              [cellEast, cellSouth],
              [cellEast, cellNorth],
              [cellWest, cellNorth],
              [cellWest, cellSouth],
            ],
          ],
        },
        properties: {
          cellIndex: index,
          rainMm,
          riskLevel: level,
          accumulationHours,
          validTime: validTimeIso,
          forecastHour: frame.forecastHour,
        },
      });
    }
  }

  return { type: "FeatureCollection", features };
}

/** Build the MapLibre source spec for the rainfall layer. */
export function buildRainfallSource(
  frame: ForecastFrame | null,
): GeoJSONSourceSpecification {
  return {
    type: "geojson",
    data: buildRainfallFeatureCollection(frame),
  };
}

/**
 * Build a GeoJSON FeatureCollection with one Point per rainfall grid cell.
 *
 * Each point is positioned at the centroid of its grid cell and carries an
 * `intensity` property (1–4) mapped from the risk level. This is the data
 * shape expected by the MapLibre heatmap layer.
 */
export function buildRainfallPointFeatureCollection(
  frame: ForecastFrame | null,
): RainfallPointCollection {
  if (!frame) {
    return { type: "FeatureCollection", features: [] };
  }

  const {
    grid,
    valuesMm,
    accumulationHours,
    area: { bbox },
  } = frame;
  const [west, south, east, north] = bbox;
  const cellLng = (east - west) / grid.width;
  const cellLat = (north - south) / grid.height;
  const expected = grid.width * grid.height;
  const validTimeIso = frame.validTime.toISOString();

  const features: Feature<Point, RainfallPointProperties>[] = [];
  for (let row = 0; row < grid.height; row += 1) {
    for (let col = 0; col < grid.width; col += 1) {
      const index = row * grid.width + col;
      if (index >= expected) break;
      const rainMm = Number.isFinite(valuesMm[index]) ? valuesMm[index] : 0;
      // Row 0 is the northern row in geographic raster grids; flip to compute
      // the cell's north edge and derive the centroid from there.
      const cellNorth = north - row * cellLat;
      const cellSouth = cellNorth - cellLat;
      const cellWest = west + col * cellLng;
      const cellEast = cellWest + cellLng;
      const centroidLng = (cellWest + cellEast) / 2;
      const centroidLat = (cellSouth + cellNorth) / 2;
      const level = classifyRainfallMm(rainMm, accumulationHours);
      features.push({
        type: "Feature",
        id: index,
        geometry: {
          type: "Point",
          coordinates: [centroidLng, centroidLat],
        },
        properties: {
          cellIndex: index,
          rainMm,
          riskLevel: level,
          intensity: RISK_INTENSITY[level],
          accumulationHours,
          validTime: validTimeIso,
          forecastHour: frame.forecastHour,
        },
      });
    }
  }

  return { type: "FeatureCollection", features };
}

/**
 * Returns the heatmap layer spec that renders a smooth interpolated rainfall
 * gradient.
 *
 * The layer weight is driven by the `intensity` property (1–4) and the color
 * ramp mirrors the four-level project risk palette: green → yellow → orange →
 * red. Visibility is driven by `visible` so callers can toggle without
 * removing and re-adding the layer.
 */
export function buildRainfallHeatmapLayer(visible: boolean): HeatmapLayerSpecification {
  return {
    id: RAINFALL_HEATMAP_LAYER_ID,
    type: "heatmap",
    source: RAINFALL_SOURCE_ID,
    maxzoom: 14,
    layout: { visibility: visible ? "visible" : "none" },
    paint: {
      // Weight by risk intensity (1–4).
      "heatmap-weight": [
        "interpolate",
        ["linear"],
        ["get", "intensity"],
        1, 0.2,
        2, 0.5,
        3, 0.8,
        4, 1.0,
      ],
      // Radius grows with zoom so the heatmap stays readable at all scales.
      "heatmap-radius": [
        "interpolate",
        ["linear"],
        ["zoom"],
        7, 20,
        12, 50,
      ],
      // Color: match project risk palette (green → yellow → orange → red).
      "heatmap-color": [
        "interpolate",
        ["linear"],
        ["heatmap-density"],
        0,   "rgba(0,0,0,0)",
        0.2, "rgba(34,197,94,0.6)",
        0.5, "rgba(234,179,8,0.7)",
        0.8, "rgba(249,115,22,0.8)",
        1.0, "rgba(239,68,68,0.9)",
      ],
      "heatmap-opacity": 0.75,
    },
  };
}

/**
 * Returns the fill layer style spec.
 *
 * Visibility is driven by `visible` so callers can reuse a single layer object
 * and toggle the rainfall view without removing/adding sources on every tab
 * change. Color encoding mirrors the four-level risk palette used elsewhere in
 * the UI.
 */
export function buildRainfallFillLayer(visible: boolean): FillLayerSpecification {
  return {
    id: RAINFALL_FILL_LAYER_ID,
    type: "fill",
    source: RAINFALL_SOURCE_ID,
    layout: { visibility: visible ? "visible" : "none" },
    paint: {
      "fill-color": [
        "match",
        ["get", "riskLevel"],
        "red",
        "#ef4444",
        "orange",
        "#f97316",
        "yellow",
        "#fbbf24",
        "green",
        "#34d399",
        "#94a3b8",
      ],
      "fill-opacity": [
        "match",
        ["get", "riskLevel"],
        "red",
        0.55,
        "orange",
        0.5,
        "yellow",
        0.45,
        "green",
        0.35,
        0.25,
      ],
    },
  };
}

/** Returns the outline layer drawn above the fill for cell separation. */
export function buildRainfallOutlineLayer(visible: boolean): LineLayerSpecification {
  return {
    id: RAINFALL_OUTLINE_LAYER_ID,
    type: "line",
    source: RAINFALL_SOURCE_ID,
    layout: { visibility: visible ? "visible" : "none" },
    paint: {
      "line-color": "rgba(255, 255, 255, 0.6)",
      "line-width": 0.6,
    },
  };
}
