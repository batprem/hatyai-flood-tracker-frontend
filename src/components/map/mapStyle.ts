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
 * literal per `bunfig.toml` and `build.ts`). If the key is missing or the
 * runtime environment does not expose `process.env` (the browser case once the
 * literal has been inlined to `undefined`), falls back to MapLibre demotiles so
 * the dashboard still renders without an account.
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
    style: MAPLIBRE_DEMO_STYLE_URL,
    provider: "maplibre-demo",
    attributionHtml: MAPLIBRE_DEMO_ATTRIBUTION,
  };
}

function readMaptilerKey(): string | undefined {
  // Bun replaces the LITERAL `process.env.VITE_MAPTILER_KEY` reference at
  // build/dev time (allow-listed via `bunfig.toml` and `build.ts`'s `define`
  // map). The substitution must be on the literal expression for the bundler
  // to catch it, so we read it directly here and rely on `build.ts` mapping
  // unset vars to the literal `undefined` (HFT-17). We still guard with
  // `typeof` so a runtime where `process` exists but the var is missing — or
  // where Bun did not perform substitution — does not throw.
  let value: string | undefined;
  try {
    value = process.env.VITE_MAPTILER_KEY;
  } catch {
    value = undefined;
  }
  if (typeof value === "string" && value.length > 0) {
    return value;
  }
  return undefined;
}
