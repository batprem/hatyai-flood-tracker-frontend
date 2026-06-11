/**
 * Pure helpers that turn typed citizen-report payloads into MapLibre
 * source/layer specs for the crowd-sourced flood-observation overlay.
 *
 * Reports deliberately use a BLUE graduated-circle scale keyed on reported
 * water depth (light/small for ankle-deep -> dark/large for above-waist). The
 * four risk colours (green/yellow/orange/red) are reserved for hazard severity
 * and the indigo "H" markers are reserved for evacuation shelters. Blue reads
 * as a water observation, distinct from both official hazard severity and
 * safe-point semantics, so a citizen report is never mistaken for an official
 * risk classification.
 *
 * A single circle layer (no sprite/symbol image) keeps the overlay light on
 * mid-range Android devices.
 *
 * Keep this module free of React/DOM imports so it stays unit-testable.
 */

import type {
  CircleLayerSpecification,
  GeoJSONSourceSpecification,
} from "maplibre-gl";
import type { Feature, FeatureCollection, Point } from "geojson";

import type { CitizenReport, WaterDepth } from "@/lib/api/reports";

/** Source ID for the citizen-reports GeoJSON. */
export const REPORTS_SOURCE_ID = "hft-reports-source";
/** Layer ID for the graduated report circles. */
export const REPORTS_CIRCLE_LAYER_ID = "hft-reports-circle";

/**
 * Blue scale, shallow -> deep. Explicitly outside the risk palette
 * (green/yellow/orange/red) and the shelter indigo (#312e81). Darker + larger
 * encodes deeper reported water without implying an official severity level.
 */
export const REPORT_DEPTH_COLORS: Record<WaterDepth, string> = {
  ankle: "#bae6fd", // sky-200
  knee: "#38bdf8", // sky-400
  waist: "#0284c7", // sky-600
  above_waist: "#075985", // sky-800
};

/** Numeric depth rank used to drive the graduated radius via a data expression. */
const DEPTH_RANK: Record<WaterDepth, number> = {
  ankle: 0,
  knee: 1,
  waist: 2,
  above_waist: 3,
};

/** GeoJSON properties carried on each report feature. */
export interface ReportFeatureProperties {
  reportId: string;
  waterDepth: WaterDepth;
  /** Numeric rank (0-3) so MapLibre interpolation can size circles by depth. */
  depthRank: number;
  note: string | null;
  hasPhoto: boolean;
  /** Root-relative photo URL or null; resolved against the API origin in the UI. */
  photoUrl: string | null;
  createdAt: string;
}

/** Type-safe alias for the report feature collection. */
export type ReportFeatureCollection = FeatureCollection<
  Point,
  ReportFeatureProperties
>;

/** Build the GeoJSON FeatureCollection for the reports overlay. */
export function buildReportFeatureCollection(
  reports: ReadonlyArray<CitizenReport>,
): ReportFeatureCollection {
  const features: Feature<Point, ReportFeatureProperties>[] = reports.map(
    (report) => ({
      type: "Feature",
      id: report.id,
      geometry: {
        type: "Point",
        coordinates: [report.location.longitude, report.location.latitude],
      },
      properties: {
        reportId: report.id,
        waterDepth: report.water_depth,
        depthRank: DEPTH_RANK[report.water_depth],
        note: report.note,
        hasPhoto: report.has_photo,
        photoUrl: report.photo_url,
        createdAt: report.created_at,
      },
    }),
  );
  return { type: "FeatureCollection", features };
}

/** Build the MapLibre GeoJSON source spec for citizen reports. */
export function buildReportsSource(
  reports: ReadonlyArray<CitizenReport>,
): GeoJSONSourceSpecification {
  return {
    type: "geojson",
    data: buildReportFeatureCollection(reports),
  };
}

/**
 * Graduated circle layer for citizen reports.
 *
 * Colour steps and radius both scale with `depthRank` so deeper reported water
 * reads as a darker, larger dot. The white stroke keeps every dot legible on
 * top of the rainfall/risk fills. Visibility is layout-controlled so the whole
 * overlay can be toggled without rebuilding the layer.
 *
 * @param visible - Initial visibility for the layer.
 */
export function buildReportsCircleLayer(
  visible: boolean,
): CircleLayerSpecification {
  return {
    id: REPORTS_CIRCLE_LAYER_ID,
    type: "circle",
    source: REPORTS_SOURCE_ID,
    layout: { visibility: visible ? "visible" : "none" },
    paint: {
      // Radius grows with depth rank, and a little with zoom for tap comfort.
      "circle-radius": [
        "interpolate",
        ["linear"],
        ["zoom"],
        7,
        ["interpolate", ["linear"], ["get", "depthRank"], 0, 5, 3, 9],
        13,
        ["interpolate", ["linear"], ["get", "depthRank"], 0, 8, 3, 16],
      ],
      // Colour by depth bucket using the explicit blue scale.
      "circle-color": [
        "match",
        ["get", "waterDepth"],
        "ankle",
        REPORT_DEPTH_COLORS.ankle,
        "knee",
        REPORT_DEPTH_COLORS.knee,
        "waist",
        REPORT_DEPTH_COLORS.waist,
        "above_waist",
        REPORT_DEPTH_COLORS.above_waist,
        REPORT_DEPTH_COLORS.ankle,
      ],
      "circle-stroke-color": "#ffffff",
      "circle-stroke-width": 1.5,
      "circle-opacity": 0.9,
    },
  };
}
