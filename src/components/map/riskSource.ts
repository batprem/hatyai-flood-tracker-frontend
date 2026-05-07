/**
 * Pure helpers that turn the basin risk overlay payload into MapLibre
 * source/layer specs.
 *
 * The Phase 1 risk overlay is a small set of mock zones that hint at where
 * elevated risk is concentrated. Each zone carries a typed `RiskLevel` so the
 * fill expression matches the rainfall layer palette.
 */

import type {
  FillLayerSpecification,
  GeoJSONSourceSpecification,
  LineLayerSpecification,
} from "maplibre-gl";
import type { Feature, FeatureCollection, Polygon } from "geojson";

import type { RiskLevel } from "@/lib/risk/rainfallThresholds";

/** Source ID for the risk-overlay polygons. */
export const RISK_SOURCE_ID = "hft-risk-source";
/** Fill layer ID for risk zones. */
export const RISK_FILL_LAYER_ID = "hft-risk-fill";
/** Outline layer ID for risk zones. */
export const RISK_OUTLINE_LAYER_ID = "hft-risk-outline";

/** Public-facing risk overlay zone. */
export interface RiskOverlayZone {
  id: string;
  level: RiskLevel;
  /** Closed ring of `[lng, lat]` coordinates (first === last). */
  ring: ReadonlyArray<readonly [number, number]>;
  labelEn: string;
  labelTh: string;
}

/** Properties exposed on each risk feature. */
export interface RiskFeatureProperties {
  zoneId: string;
  riskLevel: RiskLevel;
  labelEn: string;
  labelTh: string;
}

/** Type-safe alias for the risk feature collection. */
export type RiskFeatureCollection = FeatureCollection<Polygon, RiskFeatureProperties>;

/** Build the GeoJSON FeatureCollection for the risk overlay. */
export function buildRiskFeatureCollection(
  zones: ReadonlyArray<RiskOverlayZone>,
): RiskFeatureCollection {
  const features: Feature<Polygon, RiskFeatureProperties>[] = zones.map((zone) => ({
    type: "Feature",
    id: zone.id,
    geometry: {
      type: "Polygon",
      coordinates: [zone.ring.map((point) => [point[0], point[1]])],
    },
    properties: {
      zoneId: zone.id,
      riskLevel: zone.level,
      labelEn: zone.labelEn,
      labelTh: zone.labelTh,
    },
  }));
  return { type: "FeatureCollection", features };
}

/** Build the MapLibre GeoJSON source spec for risk zones. */
export function buildRiskSource(
  zones: ReadonlyArray<RiskOverlayZone>,
): GeoJSONSourceSpecification {
  return {
    type: "geojson",
    data: buildRiskFeatureCollection(zones),
  };
}

/** Fill layer for risk zones. */
export function buildRiskFillLayer(visible: boolean): FillLayerSpecification {
  return {
    id: RISK_FILL_LAYER_ID,
    type: "fill",
    source: RISK_SOURCE_ID,
    layout: { visibility: visible ? "visible" : "none" },
    paint: {
      "fill-color": [
        "match",
        ["get", "riskLevel"],
        "red",
        "#dc2626",
        "orange",
        "#ea580c",
        "yellow",
        "#f59e0b",
        "green",
        "#10b981",
        "#94a3b8",
      ],
      "fill-opacity": 0.35,
    },
  };
}

/** Outline drawn around risk zones for accessibility. */
export function buildRiskOutlineLayer(visible: boolean): LineLayerSpecification {
  return {
    id: RISK_OUTLINE_LAYER_ID,
    type: "line",
    source: RISK_SOURCE_ID,
    layout: { visibility: visible ? "visible" : "none" },
    paint: {
      "line-color": [
        "match",
        ["get", "riskLevel"],
        "red",
        "#991b1b",
        "orange",
        "#9a3412",
        "yellow",
        "#92400e",
        "green",
        "#065f46",
        "#475569",
      ],
      "line-width": 1.5,
      "line-opacity": 0.8,
    },
  };
}
