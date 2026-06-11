/**
 * MapLibre dashboard map for the Hat Yai / U-Tapao basin.
 *
 * Renders three toggleable layers — rainfall forecast, station pins, basin
 * risk overlay — on top of a free MapLibre demo basemap. Designed for the
 * mobile-first public alert dashboard: rotation is disabled, touch is
 * pan-only, and the visible attribution mirrors the documented tile licence.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  AttributionControl,
  Map as MapLibreMap,
  type GeoJSONSource,
  type MapLayerMouseEvent,
  NavigationControl,
} from "maplibre-gl";

import {
  BASIN_BBOX,
  BASIN_BOUNDS,
  BASIN_CENTER,
  BASIN_DEFAULT_ZOOM,
} from "@/components/map/basinArea";
import { resolveMapStyle } from "@/components/map/mapStyle";
import {
  RAINFALL_FILL_LAYER_ID,
  RAINFALL_OUTLINE_LAYER_ID,
  RAINFALL_SOURCE_ID,
  buildRainfallFeatureCollection,
  buildRainfallFillLayer,
  buildRainfallOutlineLayer,
  buildRainfallSource,
} from "@/components/map/rainfallSource";
import {
  STATIONS_LAYER_ID,
  STATIONS_SELECTED_LAYER_ID,
  STATIONS_SOURCE_ID,
  buildSelectedStationLayer,
  buildStationFeatureCollection,
  buildStationsCircleLayer,
  buildStationsSource,
  type MapStation,
  type StationFeatureProperties,
} from "@/components/map/stationsSource";
import {
  RISK_FILL_LAYER_ID,
  RISK_OUTLINE_LAYER_ID,
  RISK_SOURCE_ID,
  buildRiskFeatureCollection,
  buildRiskFillLayer,
  buildRiskOutlineLayer,
  buildRiskSource,
  type RiskOverlayZone,
} from "@/components/map/riskSource";
import { addBasinBoundaryLayer } from "@/components/map/basinBoundarySource";
import {
  SHELTERS_SOURCE_ID,
  SHELTERS_MARKER_LAYER_ID,
  SHELTERS_SYMBOL_LAYER_ID,
  SHELTERS_LABEL_LAYER_ID,
  buildSheltersSource,
  buildSheltersMarkerLayer,
  buildSheltersSymbolLayer,
  buildSheltersLabelLayer,
  buildShelterFeatureCollection,
  type ShelterFeatureProperties,
} from "@/components/map/sheltersSource";
import type { Shelter } from "@/lib/api/shelters";
import type { ForecastFrame } from "@/lib/api/forecastFrames";
import type {
  ForecastFramesCopy,
  Language,
} from "@/lib/i18n/forecastFrames";

/** Active map layer toggle. Mirrors the existing dashboard tab buttons. */
export type BasinMapLayer = "rain" | "stations" | "risk";

export interface BasinMapProps {
  /**
   * Frames available for the rainfall layer. The component renders the frame
   * selected upstream by `useRainfallForecastSlots` (passed via
   * `selectedRainfallFrame`).
   */
  rainfallFrames: ReadonlyArray<ForecastFrame>;
  /** Currently visible rainfall frame, or null if no frame is loaded. */
  selectedRainfallFrame: ForecastFrame | null;
  stations: ReadonlyArray<MapStation>;
  riskOverlay: ReadonlyArray<RiskOverlayZone>;
  /** Evacuation shelters to plot. Empty while loading or on fetch failure. */
  shelters: ReadonlyArray<Shelter>;
  /** Whether the persistent shelter overlay is currently shown. */
  showShelters: boolean;
  activeLayer: BasinMapLayer;
  selectedStationId: string | null;
  language: Language;
  copy: ForecastFramesCopy;
  onSelectStation?: (stationId: string) => void;
  onSelectShelter?: (shelterId: string) => void;
}

interface MapState {
  ready: boolean;
}

/**
 * MapLibre wrapper that owns map lifecycle for the dashboard.
 *
 * The component intentionally re-uses one map instance across re-renders and
 * mutates source data with `setData` rather than recreating sources/layers.
 * This keeps interaction smooth on low-powered mobile devices.
 */
export function BasinMap(props: BasinMapProps) {
  const {
    rainfallFrames,
    selectedRainfallFrame,
    stations,
    riskOverlay,
    shelters,
    showShelters,
    activeLayer,
    selectedStationId,
    language,
    copy,
    onSelectStation,
    onSelectShelter,
  } = props;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [state, setState] = useState<MapState>({ ready: false });
  const styleResolution = useMemo(() => resolveMapStyle(), []);

  // ---- Initialize the MapLibre instance once on mount. -----------------
  useEffect(() => {
    if (!containerRef.current) return;
    if (mapRef.current) return;

    const map = new MapLibreMap({
      container: containerRef.current,
      style: styleResolution.style,
      center: [BASIN_CENTER[0], BASIN_CENTER[1]],
      zoom: BASIN_DEFAULT_ZOOM,
      minZoom: 7,
      maxZoom: 14,
      attributionControl: false,
      // Disable rotation so two-finger gestures still pan reliably on mobile.
      pitchWithRotate: false,
      dragRotate: false,
      touchPitch: false,
      // Restrict panning roughly to the basin so users do not get lost.
      maxBounds: [
        [BASIN_BBOX[0] - 0.5, BASIN_BBOX[1] - 0.5],
        [BASIN_BBOX[2] + 0.5, BASIN_BBOX[3] + 0.5],
      ],
    });
    map.touchZoomRotate.disableRotation();
    map.keyboard.disableRotation();
    map.dragRotate.disable();

    map.addControl(
      new AttributionControl({
        compact: true,
        customAttribution: styleResolution.attributionHtml,
      }),
      "bottom-right",
    );
    map.addControl(
      new NavigationControl({ visualizePitch: false, showCompass: false }),
      "top-right",
    );

    map.on("load", () => {
      // Add sources first so layer expressions resolve cleanly.
      map.addSource(RAINFALL_SOURCE_ID, buildRainfallSource(null));
      map.addSource(STATIONS_SOURCE_ID, buildStationsSource([]));
      map.addSource(RISK_SOURCE_ID, buildRiskSource([]));
      map.addSource(SHELTERS_SOURCE_ID, buildSheltersSource([]));

      map.addLayer(buildRiskFillLayer(false));
      map.addLayer(buildRiskOutlineLayer(false));
      map.addLayer(buildRainfallFillLayer(false));
      map.addLayer(buildRainfallOutlineLayer(false));
      map.addLayer(buildStationsCircleLayer(false));
      map.addLayer(buildSelectedStationLayer(null));
      addBasinBoundaryLayer(map);
      // Shelters draw on top of every data layer so evacuation points stay
      // visible regardless of the active risk/station/rain tab.
      map.addLayer(buildSheltersMarkerLayer(false));
      map.addLayer(buildSheltersSymbolLayer(false));
      map.addLayer(buildSheltersLabelLayer(false, language));

      map.fitBounds(
        [
          [BASIN_BOUNDS[0][0], BASIN_BOUNDS[0][1]],
          [BASIN_BOUNDS[1][0], BASIN_BOUNDS[1][1]],
        ],
        { padding: 24, animate: false, maxZoom: BASIN_DEFAULT_ZOOM + 0.5 },
      );

      setState({ ready: true });
    });

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      setState({ ready: false });
    };
  }, [styleResolution]);

  // ---- Wire station click → onSelectStation. ---------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !state.ready) return;

    const handleClick = (event: MapLayerMouseEvent) => {
      const feature = event.features?.[0];
      if (!feature) return;
      const properties = feature.properties as StationFeatureProperties | undefined;
      if (!properties?.stationId) return;
      onSelectStation?.(properties.stationId);
    };
    const setCursorPointer = () => {
      map.getCanvas().style.cursor = "pointer";
    };
    const clearCursor = () => {
      map.getCanvas().style.cursor = "";
    };

    map.on("click", STATIONS_LAYER_ID, handleClick);
    map.on("mouseenter", STATIONS_LAYER_ID, setCursorPointer);
    map.on("mouseleave", STATIONS_LAYER_ID, clearCursor);
    return () => {
      map.off("click", STATIONS_LAYER_ID, handleClick);
      map.off("mouseenter", STATIONS_LAYER_ID, setCursorPointer);
      map.off("mouseleave", STATIONS_LAYER_ID, clearCursor);
    };
  }, [state.ready, onSelectStation]);

  // ---- Wire shelter marker click -> onSelectShelter. -------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !state.ready) return;

    const handleClick = (event: MapLayerMouseEvent) => {
      const feature = event.features?.[0];
      if (!feature) return;
      const properties = feature.properties as
        | ShelterFeatureProperties
        | undefined;
      if (!properties?.shelterId) return;
      onSelectShelter?.(properties.shelterId);
    };
    const setCursorPointer = () => {
      map.getCanvas().style.cursor = "pointer";
    };
    const clearCursor = () => {
      map.getCanvas().style.cursor = "";
    };

    // Bind to both the marker circle and the glyph so the whole pin is tappable.
    const layers = [SHELTERS_MARKER_LAYER_ID, SHELTERS_SYMBOL_LAYER_ID];
    for (const layerId of layers) {
      map.on("click", layerId, handleClick);
      map.on("mouseenter", layerId, setCursorPointer);
      map.on("mouseleave", layerId, clearCursor);
    }
    return () => {
      for (const layerId of layers) {
        map.off("click", layerId, handleClick);
        map.off("mouseenter", layerId, setCursorPointer);
        map.off("mouseleave", layerId, clearCursor);
      }
    };
  }, [state.ready, onSelectShelter]);

  // ---- Push rainfall data updates. -------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !state.ready) return;
    const source = map.getSource(RAINFALL_SOURCE_ID) as GeoJSONSource | undefined;
    if (!source) return;
    source.setData(buildRainfallFeatureCollection(selectedRainfallFrame));
  }, [state.ready, selectedRainfallFrame]);

  // ---- Push station data updates. --------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !state.ready) return;
    const source = map.getSource(STATIONS_SOURCE_ID) as GeoJSONSource | undefined;
    if (!source) return;
    source.setData(buildStationFeatureCollection(stations));
  }, [state.ready, stations]);

  // ---- Push risk overlay updates. --------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !state.ready) return;
    const source = map.getSource(RISK_SOURCE_ID) as GeoJSONSource | undefined;
    if (!source) return;
    source.setData(buildRiskFeatureCollection(riskOverlay));
  }, [state.ready, riskOverlay]);

  // ---- Push shelter data updates. --------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !state.ready) return;
    const source = map.getSource(SHELTERS_SOURCE_ID) as
      | GeoJSONSource
      | undefined;
    if (!source) return;
    source.setData(buildShelterFeatureCollection(shelters));
  }, [state.ready, shelters]);

  // ---- Swap shelter label language when the UI language changes. --------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !state.ready) return;
    if (!map.getLayer(SHELTERS_LABEL_LAYER_ID)) return;
    map.setLayoutProperty(SHELTERS_LABEL_LAYER_ID, "text-field", [
      "get",
      language === "th" ? "nameTh" : "nameEn",
    ]);
  }, [state.ready, language]);

  // ---- Toggle layer visibility based on the active tab. ----------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !state.ready) return;
    const visibility: Record<string, "visible" | "none"> = {
      [RAINFALL_FILL_LAYER_ID]: activeLayer === "rain" ? "visible" : "none",
      [RAINFALL_OUTLINE_LAYER_ID]: activeLayer === "rain" ? "visible" : "none",
      [STATIONS_LAYER_ID]: activeLayer === "stations" ? "visible" : "none",
      [STATIONS_SELECTED_LAYER_ID]:
        activeLayer === "stations" ? "visible" : "none",
      [RISK_FILL_LAYER_ID]: activeLayer === "risk" ? "visible" : "none",
      [RISK_OUTLINE_LAYER_ID]: activeLayer === "risk" ? "visible" : "none",
      // Shelters are a persistent, independently-toggled overlay (not part of
      // the mutually-exclusive activeLayer tabs) so they stay visible across
      // risk/rain/stations views when the user enables them.
      [SHELTERS_MARKER_LAYER_ID]: showShelters ? "visible" : "none",
      [SHELTERS_SYMBOL_LAYER_ID]: showShelters ? "visible" : "none",
      [SHELTERS_LABEL_LAYER_ID]: showShelters ? "visible" : "none",
    };
    for (const [layerId, vis] of Object.entries(visibility)) {
      if (map.getLayer(layerId)) {
        map.setLayoutProperty(layerId, "visibility", vis);
      }
    }
  }, [state.ready, activeLayer, showShelters]);

  // ---- Update the selected-station highlight filter. -------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !state.ready) return;
    if (!map.getLayer(STATIONS_SELECTED_LAYER_ID)) return;
    map.setFilter(
      STATIONS_SELECTED_LAYER_ID,
      selectedStationId
        ? ["==", ["get", "stationId"], selectedStationId]
        : ["==", ["get", "stationId"], "__none__"],
    );
  }, [state.ready, selectedStationId]);

  return (
    <div className="absolute inset-0">
      <div
        ref={containerRef}
        role="region"
        aria-label={copy.mapAriaLabel}
        data-testid="basin-map"
        data-tile-provider={styleResolution.provider}
        data-rainfall-frame-count={rainfallFrames.length}
        className="hft-basin-map h-full w-full"
        style={{ touchAction: "pan-x pan-y" }}
        lang={language}
      />
    </div>
  );
}

export default BasinMap;
