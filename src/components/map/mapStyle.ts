/**
 * Resolve a MapLibre style URL or inline style spec.
 *
 * The dashboard prefers the free MapLibre demo style so the project can run
 * without an account. If `VITE_MAPTILER_KEY` is provided at build/dev time, the
 * style switches to MapTiler's "streets-v2" style for higher-quality tiles.
 * Both providers permit the public-awareness, non-commercial usage documented
 * in `docs/data-sources.md`.
 */

import type { StyleSpecification } from "maplibre-gl";

/** What `maplibre-gl` accepts via `Map#setStyle` / constructor `style`. */
export type MapStyleSpec = StyleSpecification | string;

/** Public attribution text rendered inside the MapLibre canvas controls. */
export interface MapStyleResolution {
  /** Style URL or inline JSON spec, ready to pass to `new Map({ style })`. */
  style: MapStyleSpec;
  /** Provider key for analytics / debugging. */
  provider: "maplibre-demo" | "maptiler";
  /** Single short attribution string (HTML allowed by MapLibre AttributionControl). */
  attributionHtml: string;
}

const MAPLIBRE_DEMO_STYLE_URL = "https://demotiles.maplibre.org/style.json";
const MAPLIBRE_DEMO_ATTRIBUTION =
  '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap contributors</a> · <a href="https://maplibre.org/" target="_blank" rel="noopener">MapLibre demotiles</a>';

const MAPTILER_ATTRIBUTION =
  '<a href="https://www.maptiler.com/copyright/" target="_blank" rel="noopener">© MapTiler</a> · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap contributors</a>';

/**
 * Build a MapLibre style + attribution pair using the configured tile provider.
 *
 * Reads `process.env.VITE_MAPTILER_KEY` at build/dev time (Bun inlines the
 * literal per `bunfig.toml`). If the key is missing, falls back to MapLibre
 * demotiles so the dashboard still renders during local development.
 */
export function resolveMapStyle(): MapStyleResolution {
  const maptilerKey = readEnv("VITE_MAPTILER_KEY");
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
    style: MAPLIBRE_DEMO_STYLE_URL,
    provider: "maplibre-demo",
    attributionHtml: MAPLIBRE_DEMO_ATTRIBUTION,
  };
}

function readEnv(name: "VITE_MAPTILER_KEY"): string | undefined {
  // Bun replaces literal `process.env.VITE_*` references at build/dev time.
  // Use the static literal so the bundler can inline the value; fall back to
  // an `undefined` lookup so the function still works under tooling that does
  // not perform the substitution.
  const value = name === "VITE_MAPTILER_KEY" ? process.env.VITE_MAPTILER_KEY : undefined;
  if (typeof value === "string" && value.length > 0) {
    return value;
  }
  return undefined;
}
