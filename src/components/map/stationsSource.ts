/**
 * Pure helpers that turn typed station payloads into MapLibre source/layer
 * specs for the station-pin overlay.
 */

import type {
  CircleLayerSpecification,
  GeoJSONSourceSpecification,
} from "maplibre-gl";
import type { Feature, FeatureCollection, Point } from "geojson";

import type { RiskLevel } from "@/lib/risk/rainfallThresholds";

/** Trend categories surfaced in the station card. */
export type StationTrend = "rising" | "stable" | "falling";

/**
 * Map-friendly station shape. Phase 1 uses geographic coordinates instead of
 * the previous CSS-percentage `position` so MapLibre can place pins directly.
 */
export interface MapStation {
  id: string;
  /** [longitude, latitude] in EPSG:4326. */
  coordinates: readonly [number, number];
  risk: RiskLevel;
  waterLevelM: number;
  trend: StationTrend;
  nameEn: string;
  nameTh: string;
}

/** Source ID for the station GeoJSON. */
export const STATIONS_SOURCE_ID = "hft-stations-source";
/** Layer ID for station circle markers. */
export const STATIONS_LAYER_ID = "hft-stations-circles";
/** Layer ID for the selected-station highlight ring. */
export const STATIONS_SELECTED_LAYER_ID = "hft-stations-selected";

/** GeoJSON properties on each station feature. */
export interface StationFeatureProperties {
  stationId: string;
  riskLevel: RiskLevel;
  waterLevelM: number;
  trend: StationTrend;
  nameEn: string;
  nameTh: string;
}

/** Type-safe alias for the station feature collection. */
export type StationFeatureCollection = FeatureCollection<Point, StationFeatureProperties>;

/** Build the GeoJSON FeatureCollection for the station overlay. */
export function buildStationFeatureCollection(
  stations: ReadonlyArray<MapStation>,
): StationFeatureCollection {
  const features: Feature<Point, StationFeatureProperties>[] = stations.map(
    (station) => ({
      type: "Feature",
      id: station.id,
      geometry: {
        type: "Point",
        coordinates: [station.coordinates[0], station.coordinates[1]],
      },
      properties: {
        stationId: station.id,
        riskLevel: station.risk,
        waterLevelM: station.waterLevelM,
        trend: station.trend,
        nameEn: station.nameEn,
        nameTh: station.nameTh,
      },
    }),
  );
  return { type: "FeatureCollection", features };
}

/** Build the MapLibre GeoJSON source spec for stations. */
export function buildStationsSource(
  stations: ReadonlyArray<MapStation>,
): GeoJSONSourceSpecification {
  return {
    type: "geojson",
    data: buildStationFeatureCollection(stations),
  };
}

/** Layer that renders one circle per station. */
export function buildStationsCircleLayer(visible: boolean): CircleLayerSpecification {
  return {
    id: STATIONS_LAYER_ID,
    type: "circle",
    source: STATIONS_SOURCE_ID,
    layout: { visibility: visible ? "visible" : "none" },
    paint: {
      "circle-radius": [
        "interpolate",
        ["linear"],
        ["zoom"],
        7,
        6,
        12,
        12,
      ],
      "circle-color": [
        "match",
        ["get", "riskLevel"],
        "red",
        "#ef4444",
        "orange",
        "#f97316",
        "yellow",
        "#fbbf24",
        "green",
        "#10b981",
        "#0ea5e9",
      ],
      "circle-stroke-color": "#ffffff",
      "circle-stroke-width": 2,
      "circle-opacity": 0.95,
    },
  };
}

/**
 * Highlight ring for the currently selected station. Filters on `stationId`
 * via a runtime filter set by the BasinMap component.
 */
export function buildSelectedStationLayer(
  selectedStationId: string | null,
): CircleLayerSpecification {
  return {
    id: STATIONS_SELECTED_LAYER_ID,
    type: "circle",
    source: STATIONS_SOURCE_ID,
    filter: selectedStationId
      ? ["==", ["get", "stationId"], selectedStationId]
      : ["==", ["get", "stationId"], "__none__"],
    paint: {
      "circle-radius": [
        "interpolate",
        ["linear"],
        ["zoom"],
        7,
        12,
        12,
        20,
      ],
      "circle-color": "transparent",
      "circle-stroke-color": "rgba(15, 23, 42, 0.6)",
      "circle-stroke-width": 4,
    },
  };
}
