/**
 * Citizen flood-report submission modal.
 *
 * A focused, mobile-first dialog opened from the dashboard header action stack.
 * Flow:
 *   1. Pick the flooded location on a small MapLibre map — the pin defaults to
 *      the device's geolocation when granted, otherwise the map/basin centre
 *      with an explicit note. The pin is draggable and tap-to-move.
 *   2. Choose a water depth with a 4-button segmented control (large tap
 *      targets, rising-water icons).
 *   3. Optionally add a note (capped at the backend's 500-char limit) and a
 *      photo (`capture="environment"` so mobile opens the rear camera).
 *   4. Submit via `submitReport` (multipart). 400/422/429 map to distinct
 *      bilingual copy; success shows a pending-moderation confirmation.
 *
 * Basin constraint is enforced in two layers: a lightweight client-side
 * `BASIN_BBOX` pre-check for instant feedback, plus the authoritative backend
 * 400 surfaced bilingually. No heavy geo dependency (no turf).
 */

import { useEffect, useRef, useState } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  Map as MapLibreMap,
  Marker,
  type MapMouseEvent,
} from "maplibre-gl";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Footprints,
  Loader2,
  LocateFixed,
  PersonStanding,
  Waves,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  BASIN_BBOX,
  BASIN_CENTER,
  BASIN_DEFAULT_ZOOM,
} from "@/components/map/basinArea";
import { resolveMapStyle } from "@/components/map/mapStyle";
import {
  REPORT_NOTE_MAX_LENGTH,
  ReportsApiClientError,
  submitReport,
  WaterDepthValues,
  type WaterDepth,
} from "@/lib/api/reports";
import type { ForecastFramesCopy, Language } from "@/lib/i18n/forecastFrames";
import { cn } from "@/lib/utils";

export interface ReportFloodingDialogProps {
  open: boolean;
  onClose: () => void;
  language: Language;
  copy: ForecastFramesCopy;
  /** Called after a report is accepted so the caller can refresh the layer. */
  onSubmitted?: () => void;
}

/** Lifecycle of the submission request. */
type SubmitPhase = "idle" | "submitting" | "success" | "error";

/** Icon per depth bucket — rising-water metaphor, shallow -> deep. */
const DEPTH_ICONS: Record<WaterDepth, typeof Footprints> = {
  ankle: Footprints,
  knee: PersonStanding,
  waist: Waves,
  above_waist: AlertTriangle,
};

/** True when a point is inside the supported basin bbox (client pre-check). */
function isInsideBasin(lng: number, lat: number): boolean {
  const [west, south, east, north] = BASIN_BBOX;
  return lng >= west && lng <= east && lat >= south && lat <= north;
}

/** Map a submission error to a bilingual copy string the user can act on. */
function resolveSubmitErrorMessage(
  error: unknown,
  copy: ForecastFramesCopy,
): string {
  if (error instanceof ReportsApiClientError) {
    const { detail } = error;
    if (detail.kind === "network") return copy.reportErrorNetwork;
    if (detail.kind === "http") {
      switch (detail.status) {
        case 400:
          // Backend returns 400 for both outside-basin and invalid-photo.
          return /photo/i.test(detail.body ?? "")
            ? copy.reportErrorInvalidPhoto
            : copy.reportErrorOutsideBasin;
        case 422:
          return copy.reportErrorBadFields;
        case 429:
          return copy.reportErrorRateLimit;
        default:
          return copy.reportErrorGeneric;
      }
    }
  }
  return copy.reportErrorGeneric;
}

export function ReportFloodingDialog({
  open,
  onClose,
  language,
  copy,
  onSubmitted,
}: ReportFloodingDialogProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markerRef = useRef<Marker | null>(null);

  // Picked location as [lng, lat]; starts at the basin centre until the map
  // initialises or the device location resolves.
  const [pin, setPin] = useState<[number, number]>([
    BASIN_CENTER[0],
    BASIN_CENTER[1],
  ]);
  const [usingDeviceLocation, setUsingDeviceLocation] = useState(false);
  const [depth, setDepth] = useState<WaterDepth | null>(null);
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [phase, setPhase] = useState<SubmitPhase>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const pinInsideBasin = isInsideBasin(pin[0], pin[1]);

  // ---- Reset transient state whenever the dialog (re)opens. -------------
  useEffect(() => {
    if (!open) return;
    setDepth(null);
    setNote("");
    setPhoto(null);
    setPhase("idle");
    setErrorMessage(null);
  }, [open]);

  // ---- Initialise the pin-picker map while the dialog is open. ----------
  useEffect(() => {
    if (!open) return;
    if (!mapContainerRef.current) return;
    if (mapRef.current) return;

    const { style } = resolveMapStyle();
    const map = new MapLibreMap({
      container: mapContainerRef.current,
      style,
      center: [BASIN_CENTER[0], BASIN_CENTER[1]],
      zoom: BASIN_DEFAULT_ZOOM + 1,
      minZoom: 8,
      maxZoom: 16,
      attributionControl: false,
      pitchWithRotate: false,
      dragRotate: false,
      touchPitch: false,
    });
    map.dragRotate.disable();
    map.touchZoomRotate.disableRotation();

    const marker = new Marker({ color: "#0284c7", draggable: true })
      .setLngLat([BASIN_CENTER[0], BASIN_CENTER[1]])
      .addTo(map);

    marker.on("dragend", () => {
      const { lng, lat } = marker.getLngLat();
      setPin([lng, lat]);
    });

    const handleMapClick = (event: MapMouseEvent) => {
      const { lng, lat } = event.lngLat;
      marker.setLngLat([lng, lat]);
      setPin([lng, lat]);
    };
    map.on("click", handleMapClick);

    mapRef.current = map;
    markerRef.current = marker;

    // Try to centre on the device location for a faster, accurate pin.
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lng = position.coords.longitude;
          const lat = position.coords.latitude;
          // Only adopt the device location if it falls inside the basin;
          // otherwise keep the basin-centre default with the explicit note.
          if (isInsideBasin(lng, lat)) {
            marker.setLngLat([lng, lat]);
            map.setCenter([lng, lat]);
            setPin([lng, lat]);
            setUsingDeviceLocation(true);
          }
        },
        () => {
          // Denied/unavailable: keep the basin-centre default.
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 300000 },
      );
    }

    return () => {
      map.off("click", handleMapClick);
      marker.remove();
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, [open]);

  // ---- Recenter the small map when the marker moves to keep it in view. -
  const handleUseMyLocation = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lng = position.coords.longitude;
        const lat = position.coords.latitude;
        markerRef.current?.setLngLat([lng, lat]);
        mapRef.current?.flyTo({ center: [lng, lat], zoom: BASIN_DEFAULT_ZOOM + 2 });
        setPin([lng, lat]);
        setUsingDeviceLocation(isInsideBasin(lng, lat));
      },
      () => {
        // Denied/unavailable: leave the current pin untouched.
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 },
    );
  };

  if (!open) return null;

  const canSubmit =
    depth !== null && pinInsideBasin && phase !== "submitting";

  const handleSubmit = async () => {
    if (depth === null || !pinInsideBasin) return;
    setPhase("submitting");
    setErrorMessage(null);
    try {
      await submitReport({
        longitude: pin[0],
        latitude: pin[1],
        waterDepth: depth,
        note: note.trim() || undefined,
        photo,
      });
      setPhase("success");
      onSubmitted?.();
    } catch (error: unknown) {
      if (
        error instanceof ReportsApiClientError &&
        error.detail.kind === "aborted"
      ) {
        return;
      }
      setErrorMessage(resolveSubmitErrorMessage(error, copy));
      setPhase("error");
    }
  };

  const resetForAnother = () => {
    setDepth(null);
    setNote("");
    setPhoto(null);
    setPhase("idle");
    setErrorMessage(null);
  };

  const noteRemaining = REPORT_NOTE_MAX_LENGTH - note.length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={copy.reportEntry}
      data-testid="report-flooding-dialog"
    >
      <div className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-[2rem] bg-white text-slate-950 shadow-2xl sm:rounded-[2rem]">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 p-4 sm:p-5">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-black text-slate-900">
              <Waves className="size-5 text-sky-600" aria-hidden />
              {copy.reportEntry}
            </h2>
            <p className="mt-1 text-sm text-slate-600">{copy.reportSubtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={copy.reportCancel}
            className="shrink-0 rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>

        {phase === "success" ? (
          <div className="flex flex-col items-center gap-4 p-8 text-center">
            <span className="flex size-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="size-9" aria-hidden />
            </span>
            <div>
              <p className="text-lg font-black text-slate-900">
                {copy.reportSuccessTitle}
              </p>
              <p className="mt-1 text-sm text-slate-600">{copy.reportSuccess}</p>
            </div>
            <div className="flex w-full flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                className="flex-1 rounded-full"
                onClick={resetForAnother}
              >
                {copy.reportSubmitAnother}
              </Button>
              <Button
                type="button"
                className="flex-1 rounded-full bg-sky-600 text-white hover:bg-sky-500"
                onClick={onClose}
              >
                {copy.reportCancel}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex-1 space-y-5 overflow-y-auto p-4 sm:p-5">
            {/* Location pick */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-bold text-slate-800">
                  {copy.reportLocationLabel}
                </label>
                <button
                  type="button"
                  onClick={handleUseMyLocation}
                  className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-bold text-sky-700 transition hover:bg-sky-100"
                >
                  <LocateFixed className="size-3.5" aria-hidden />
                  {copy.reportUseMyLocation}
                </button>
              </div>
              <div
                ref={mapContainerRef}
                data-testid="report-pin-map"
                className="h-48 w-full overflow-hidden rounded-2xl border border-slate-200"
                style={{ touchAction: "pan-x pan-y" }}
              />
              <p className="text-xs text-slate-500">{copy.reportLocationHint}</p>
              {!usingDeviceLocation && (
                <p className="text-xs text-slate-500">
                  {copy.reportLocationCenterNote}
                </p>
              )}
              {!pinInsideBasin && (
                <p
                  className="rounded-xl border border-orange-200 bg-orange-50 p-2 text-xs font-semibold text-orange-800"
                  role="alert"
                >
                  {copy.reportPinOutsideBasin}
                </p>
              )}
            </div>

            {/* Depth segmented control */}
            <fieldset className="space-y-2">
              <legend className="text-sm font-bold text-slate-800">
                {copy.reportDepthLabel}
              </legend>
              <div className="grid grid-cols-4 gap-2">
                {WaterDepthValues.map((value) => {
                  const Icon = DEPTH_ICONS[value];
                  const selected = depth === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setDepth(value)}
                      aria-pressed={selected}
                      className={cn(
                        "flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-2xl border p-2 text-center transition",
                        selected
                          ? "border-sky-600 bg-sky-50 text-sky-800 ring-2 ring-sky-200"
                          : "border-slate-200 text-slate-600 hover:border-sky-300 hover:bg-slate-50",
                      )}
                    >
                      <Icon className="size-6" aria-hidden />
                      <span className="text-xs font-bold leading-tight">
                        {copy.reportDepthLabels[value]}
                      </span>
                    </button>
                  );
                })}
              </div>
            </fieldset>

            {/* Note */}
            <div className="space-y-1.5">
              <label
                htmlFor="report-note"
                className="text-sm font-bold text-slate-800"
              >
                {copy.reportNoteLabel}
              </label>
              <textarea
                id="report-note"
                value={note}
                maxLength={REPORT_NOTE_MAX_LENGTH}
                onChange={(event) =>
                  setNote(event.currentTarget.value.slice(0, REPORT_NOTE_MAX_LENGTH))
                }
                placeholder={copy.reportNotePlaceholder}
                rows={3}
                className="w-full resize-none rounded-2xl border border-slate-200 p-3 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
              />
              <p
                className={cn(
                  "text-right text-xs",
                  noteRemaining <= 0 ? "font-semibold text-orange-600" : "text-slate-400",
                )}
                aria-live="polite"
              >
                {copy.reportNoteCounter(note.length, REPORT_NOTE_MAX_LENGTH)}
              </p>
            </div>

            {/* Photo */}
            <div className="space-y-1.5">
              <label
                htmlFor="report-photo"
                className="flex items-center gap-2 text-sm font-bold text-slate-800"
              >
                <Camera className="size-4 text-slate-500" aria-hidden />
                {copy.reportPhotoLabel}
              </label>
              <input
                id="report-photo"
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(event) =>
                  setPhoto(event.currentTarget.files?.[0] ?? null)
                }
                className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-full file:border-0 file:bg-sky-50 file:px-4 file:py-2 file:text-sm file:font-bold file:text-sky-700 hover:file:bg-sky-100"
              />
              {photo && (
                <p className="truncate text-xs text-slate-500">{photo.name}</p>
              )}
            </div>

            {/* Privacy reassurance */}
            <p className="rounded-2xl border border-slate-100 bg-slate-50 p-3 text-xs leading-snug text-slate-500">
              {copy.reportPrivacy}
            </p>

            {/* Error */}
            {phase === "error" && errorMessage && (
              <p
                className="flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-800"
                role="alert"
              >
                <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                {errorMessage}
              </p>
            )}

            {/* Actions */}
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                className="rounded-full sm:flex-1"
                onClick={onClose}
                disabled={phase === "submitting"}
              >
                {copy.reportCancel}
              </Button>
              <Button
                type="button"
                className="rounded-full bg-sky-600 text-white hover:bg-sky-500 disabled:opacity-50 sm:flex-[2]"
                onClick={() => void handleSubmit()}
                disabled={!canSubmit}
              >
                {phase === "submitting" ? (
                  <>
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                    {copy.reportSubmitting}
                  </>
                ) : (
                  copy.reportSubmit
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ReportFloodingDialog;
