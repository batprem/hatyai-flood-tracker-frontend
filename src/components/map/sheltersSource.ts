/**
 * Pure helpers that turn typed shelter payloads into MapLibre source/layer
 * specs for the evacuation-shelter overlay.
 *
 * Shelters deliberately use a neutral house-glyph symbol on a slate background
 * rather than a risk-coloured circle. The four risk colours (green/yellow/
 * orange/red) are reserved for hazard severity; reusing them for shelters would
 * collide with the safety colour language and could read as "this shelter is
 * dangerous". A symbol layer also stays legible against any active risk fill.
 *
 * Keep this module free of React/DOM imports so it stays unit-testable.
 */

import type {
  CircleLayerSpecification,
  SymbolLayerSpecification,
  GeoJSONSourceSpecification,
} from "maplibre-gl";
import type { Feature, FeatureCollection, Point } from "geojson";

import type { Shelter, ShelterType } from "@/lib/api/shelters";

/** Source ID for the shelter GeoJSON. */
export const SHELTERS_SOURCE_ID = "hft-shelters-source";
/** Layer ID for the neutral shelter marker background circle. */
export const SHELTERS_MARKER_LAYER_ID = "hft-shelters-marker";
/** Layer ID for the shelter glyph rendered on top of the background. */
export const SHELTERS_SYMBOL_LAYER_ID = "hft-shelters-symbol";

/** Accent colour used for shelter markers — intentionally outside the risk palette. */
export const SHELTER_ACCENT_COLOR = "#312e81"; // indigo-900

/** GeoJSON properties carried on each shelter feature. */
export interface ShelterFeatureProperties {
  shelterId: string;
  nameEn: string;
  nameTh: string;
  shelterType: ShelterType;
  /** capacity is encoded as -1 when unknown so the value stays a number for MapLibre. */
  capacity: number;
  municipalityTh: string;
}

/** Type-safe alias for the shelter feature collection. */
export type ShelterFeatureCollection = FeatureCollection<
  Point,
  ShelterFeatureProperties
>;

/** Sentinel used in feature properties when capacity is unknown (null in the API). */
export const CAPACITY_UNKNOWN = -1;

/** Build the GeoJSON FeatureCollection for the shelter overlay. */
export function buildShelterFeatureCollection(
  shelters: ReadonlyArray<Shelter>,
): ShelterFeatureCollection {
  const features: Feature<Point, ShelterFeatureProperties>[] = shelters.map(
    (shelter) => ({
      type: "Feature",
      id: shelter.id,
      geometry: {
        type: "Point",
        coordinates: [shelter.location.longitude, shelter.location.latitude],
      },
      properties: {
        shelterId: shelter.id,
        nameEn: shelter.name_en,
        nameTh: shelter.name_th,
        shelterType: shelter.type,
        capacity: shelter.capacity ?? CAPACITY_UNKNOWN,
        municipalityTh: shelter.municipality_th,
      },
    }),
  );
  return { type: "FeatureCollection", features };
}

/** Build the MapLibre GeoJSON source spec for shelters. */
export function buildSheltersSource(
  shelters: ReadonlyArray<Shelter>,
): GeoJSONSourceSpecification {
  return {
    type: "geojson",
    data: buildShelterFeatureCollection(shelters),
  };
}

/**
 * Background pin for each shelter — a rounded slate marker that frames the glyph
 * and provides a generous tap target on mobile. Colour is fixed (no risk match
 * expression) so it never reads as a hazard severity.
 */
export function buildSheltersMarkerLayer(
  visible: boolean,
): CircleLayerSpecification {
  return {
    id: SHELTERS_MARKER_LAYER_ID,
    type: "circle",
    source: SHELTERS_SOURCE_ID,
    layout: { visibility: visible ? "visible" : "none" },
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 7, 9, 12, 15],
      "circle-color": SHELTER_ACCENT_COLOR,
      "circle-stroke-color": "#ffffff",
      "circle-stroke-width": 2,
      "circle-opacity": 0.95,
    },
  };
}

/**
 * Glyph layer for shelters. Renders a bold "H" mark centred on each shelter
 * marker via the basemap glyph stack, so no sprite/icon image needs loading.
 *
 * @param visible - Initial visibility for the layer.
 */
export function buildSheltersSymbolLayer(
  visible: boolean,
): SymbolLayerSpecification {
  return {
    id: SHELTERS_SYMBOL_LAYER_ID,
    type: "symbol",
    source: SHELTERS_SOURCE_ID,
    layout: {
      visibility: visible ? "visible" : "none",
      // Latin "H" (shelter/help point) renders reliably in every glyph stack,
      // unlike emoji which the MapLibre demotiles font may omit.
      "text-field": "H",
      "text-font": ["Open Sans Bold", "Noto Sans Bold"],
      "text-size": ["interpolate", ["linear"], ["zoom"], 7, 11, 12, 16],
      "text-allow-overlap": true,
      "text-ignore-placement": true,
      // Secondary label appears only when zoomed in, to avoid clutter.
      "symbol-z-order": "source",
    },
    paint: {
      "text-color": "#ffffff",
      "text-halo-color": SHELTER_ACCENT_COLOR,
      "text-halo-width": 1,
    },
  };
}

/**
 * Separate label layer for shelter names, shown only at closer zoom so the map
 * is not crowded when the whole basin is in view.
 *
 * @param visible - Initial visibility for the layer.
 * @param language - Active UI language; selects the Thai or English name field.
 */
export function buildSheltersLabelLayer(
  visible: boolean,
  language: "th" | "en",
): SymbolLayerSpecification {
  const nameField = language === "th" ? "nameTh" : "nameEn";
  return {
    id: `${SHELTERS_SYMBOL_LAYER_ID}-label`,
    type: "symbol",
    source: SHELTERS_SOURCE_ID,
    minzoom: 11,
    layout: {
      visibility: visible ? "visible" : "none",
      "text-field": ["get", nameField],
      "text-size": 11,
      "text-offset": [0, 1.4],
      "text-anchor": "top",
      "text-max-width": 10,
      "text-optional": true,
    },
    paint: {
      "text-color": "#1e1b4b",
      "text-halo-color": "#ffffff",
      "text-halo-width": 1.5,
    },
  };
}

/** Layer ID for the shelter name labels. */
export const SHELTERS_LABEL_LAYER_ID = `${SHELTERS_SYMBOL_LAYER_ID}-label`;
