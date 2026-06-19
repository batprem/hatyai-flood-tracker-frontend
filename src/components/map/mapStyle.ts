/**
 * Resolve a MapLibre style URL or inline style spec.
 *
 * The dashboard prefers the OpenFreeMap "bright" style so the project can run
 * without an account and still show roads, place names, and water bodies. If
 * `VITE_MAPTILER_KEY` is provided at build/dev time, the style switches to
 * MapTiler's "streets-v2" style for higher-quality tiles. Both providers
 * permit the public-awareness, non-commercial usage documented in
 * `docs/data-sources.md`.
 */

import type { StyleSpecification } from "maplibre-gl";

/** What `maplibre-gl` accepts via `Map#setStyle` / constructor `style`. */
export type MapStyleSpec = StyleSpecification | string;

/** Public attribution text rendered inside the MapLibre canvas controls. */
export interface MapStyleResolution {
  /** Style URL or inline JSON spec, ready to pass to `new Map({ style })`. */
  style: MapStyleSpec;
  /** Provider key for analytics / debugging. */
  provider: "openfreemap" | "maptiler";
  /** Single short attribution string (HTML allowed by MapLibre AttributionControl). */
  attributionHtml: string;
}

const OPENFREEMAP_STYLE_URL = "https://tiles.openfreemap.org/styles/bright";
const OPENFREEMAP_ATTRIBUTION =
  '<a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a> · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap contributors</a>';

const MAPTILER_ATTRIBUTION =
  '<a href="https://www.maptiler.com/copyright/" target="_blank" rel="noopener">© MapTiler</a> · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap contributors</a>';

/**
 * Build a MapLibre style + attribution pair using the configured tile provider.
 *
 * Reads `import.meta.env.VITE_MAPTILER_KEY` at build/dev time via Vite's env
 * substitution. If the key is absent, falls back to the OpenFreeMap "bright"
 * style so the dashboard renders roads and place names without an account.
 */
export function resolveMapStyle(): MapStyleResolution {
  const maptilerKey = readMaptilerKey();
  if (maptilerKey) {
    return {
      style: `https://api.maptiler.com/maps/streets-v2/style.json?key=${encodeURIComponent(
        maptilerKey,
      )}`,
      provider: "maptiler",
      attributionHtml: MAPTILER_ATTRIBUTION,
    };
  }
  return {
    style: OPENFREEMAP_STYLE_URL,
    provider: "openfreemap",
    attributionHtml: OPENFREEMAP_ATTRIBUTION,
  };
}

function readMaptilerKey(): string | undefined {
  const value = import.meta.env.VITE_MAPTILER_KEY;
  if (typeof value === "string" && value.length > 0) {
    return value;
  }
  return undefined;
}
