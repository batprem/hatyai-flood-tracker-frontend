import {
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  AlertOctagon,
  AlertTriangle,
  Clock3,
  CloudRain,
  Droplets,
  Gauge,
  Home,
  Info,
  Languages,
  Layers,
  type LucideIcon,
  MapPin,
  Megaphone,
  Navigation,
  RadioTower,
  RefreshCw,
  ShieldCheck,
  Waves,
  WifiOff,
} from "lucide-react";

import "./index.css";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertSubscriptionButton } from "@/components/AlertSubscriptionButton";
import { BasinMap, type BasinMapLayer } from "@/components/BasinMap";
import { ReportFloodingDialog } from "@/components/ReportFloodingDialog";
import { MapErrorBoundary } from "@/components/MapErrorBoundary";
import { useRainfallForecastSlots } from "@/components/forecast/ForecastRainfallPanel";
import type { MapStation } from "@/components/map/stationsSource";
import type { RiskOverlayZone } from "@/components/map/riskSource";
import { BASIN_CENTER } from "@/components/map/basinArea";
import type { ForecastFreshness } from "@/lib/api/forecastFrames";
import {
  fetchCurrentRisk,
  type CurrentRiskResponse,
  type ProviderResult,
} from "@/lib/api/risk";
import {
  fetchShelters,
  nearestShelters,
  SheltersApiClientError,
  type Shelter,
  type ShelterType,
  type ShelterWithDistance,
} from "@/lib/api/shelters";
import {
  fetchApprovedReports,
  resolveReportPhotoUrl,
  ReportsApiClientError,
  WaterDepthValues,
  type CitizenReport,
  type WaterDepth,
} from "@/lib/api/reports";
import { REPORT_DEPTH_COLORS } from "@/components/map/reportsSource";
import type { ForecastFramesPhase } from "@/lib/hooks/useForecastFrames";
import {
  FORECAST_FRAMES_COPY,
  formatDateTime,
  formatRelativeTime,
  freshnessLabel,
  type Language as ForecastLanguage,
} from "@/lib/i18n/forecastFrames";
import { cn } from "@/lib/utils";

type Language = "th" | "en";
type RiskLevel = "green" | "yellow" | "orange" | "red";
type MapLayer = BasinMapLayer;

/**
 * Historical-events route, code-split so its component tree (and the data it
 * pulls in) is only downloaded when a user actually visits `/history`. The
 * dashboard is the hot path on low-powered mobile; the research-oriented
 * history view is secondary, so deferring it keeps the initial bundle smaller.
 * `HistoricalEventList` is a named export, so the dynamic import maps it onto
 * the `default` shape `lazy` expects.
 */
const HistoricalEventList = lazy(() =>
  import("@/components/HistoricalEventList").then((module) => ({
    default: module.HistoricalEventList,
  })),
);

type RiskMeta = {
  label: Record<Language, string>;
  meaning: Record<Language, string>;
  action: Record<Language, string>;
  badgeClass: string;
  dotClass: string;
  panelClass: string;
  mapClass: string;
  /**
   * Non-color redundant cues so color-blind users can tell the four levels
   * apart without relying on hue. `Icon` is a distinct escalation glyph; `glyph`
   * is a compact text marker (also color-independent) used where an icon does
   * not fit. WCAG SC 1.4.1 (Use of Color): color is never the only channel.
   */
  Icon: LucideIcon;
  glyph: string;
};

type ForecastStep = {
  hour: string;
  rainMm: number;
  level: RiskLevel;
  confidence: number;
};

type Station = {
  id: string;
  name: Record<Language, string>;
  area: Record<Language, string>;
  waterLevelM: number;
  trend: "rising" | "stable" | "falling";
  risk: RiskLevel;
  /** [longitude, latitude] in EPSG:4326 inside the U-Tapao basin bbox. */
  coordinates: readonly [number, number];
  /**
   * UTC datetime of the most recent observation.
   * Mock stations use a fixed past time; replace with API `observedAt` when
   * the station endpoint is live.
   */
  observedAt: Date;
};

const riskOrder: RiskLevel[] = ["green", "yellow", "orange", "red"];

const riskMeta: Record<RiskLevel, RiskMeta> = {
  green: {
    label: { th: "เขียว", en: "Green" },
    meaning: { th: "เฝ้าระวังปกติ", en: "Normal monitoring" },
    action: {
      th: "ติดตามพยากรณ์และตรวจสอบแผนเดินทาง",
      en: "Follow forecasts and check travel plans",
    },
    badgeClass: "border-emerald-300 bg-emerald-50 text-emerald-800",
    dotClass: "bg-emerald-500",
    panelClass: "from-emerald-500 to-teal-500",
    mapClass: "bg-emerald-400/70 border-emerald-100",
    Icon: ShieldCheck,
    glyph: "1",
  },
  yellow: {
    label: { th: "เหลือง", en: "Yellow" },
    meaning: { th: "ฝนสะสมเริ่มสูง", en: "Rainfall building" },
    action: {
      th: "เตรียมของจำเป็นและติดตามสถานีใกล้บ้าน",
      en: "Prepare essentials and watch nearby stations",
    },
    badgeClass: "border-amber-300 bg-amber-50 text-amber-800",
    dotClass: "bg-amber-400",
    panelClass: "from-amber-400 to-yellow-500",
    mapClass: "bg-amber-400/75 border-amber-100",
    Icon: Info,
    glyph: "2",
  },
  orange: {
    label: { th: "ส้ม", en: "Orange" },
    meaning: { th: "เสี่ยงน้ำล้นตลิ่งบางจุด", en: "Localized overflow risk" },
    action: {
      th: "หลีกเลี่ยงเส้นทางต่ำและย้ายของขึ้นที่สูง",
      en: "Avoid low routes and move valuables higher",
    },
    badgeClass: "border-orange-300 bg-orange-50 text-orange-800",
    dotClass: "bg-orange-500",
    panelClass: "from-orange-500 to-red-400",
    mapClass: "bg-orange-500/75 border-orange-100",
    Icon: AlertTriangle,
    glyph: "3",
  },
  red: {
    label: { th: "แดง", en: "Red" },
    meaning: { th: "อาจเกิดน้ำท่วมฉับพลัน", en: "Flash flood possible" },
    action: {
      th: "ติดตามประกาศทางการและเตรียมอพยพ",
      en: "Follow official notices and prepare to evacuate",
    },
    badgeClass: "border-red-300 bg-red-50 text-red-800",
    dotClass: "bg-red-500",
    panelClass: "from-red-600 to-rose-500",
    mapClass: "bg-red-500/80 border-red-100",
    Icon: AlertOctagon,
    glyph: "4",
  },
};

const copy = {
  th: {
    product: "Hat Yai Flood Watch",
    eyebrow: "ต้นแบบสาธารณะ · ลุ่มน้ำคลองอู่ตะเภาและทะเลสาบสงขลา",
    title: "เฝ้าระวังน้ำท่วมหาดใหญ่",
    subtitle:
      "ภาพรวมความเสี่ยงจากฝนคาดการณ์ ระดับน้ำสถานี และคำแนะนำสำหรับประชาชนใน 72 ชั่วโมงข้างหน้า",
    currentStatus: "สถานการณ์ปัจจุบัน",
    forecastTrend: "แนวโน้ม 72 ชม.",
    riskScale: "ระดับความเสี่ยง",
    mapTitle: "แผนที่สถานการณ์",
    mapSubtitle: "ชั้นข้อมูลจำลองสำหรับฝนคาดการณ์ ความเสี่ยง และสถานีวัดน้ำ",
    confidence: "ความมั่นใจ",
    rain: "ฝนสะสม",
    water: "ระดับน้ำ",
    trend: "แนวโน้ม",
    layers: {
      risk: "ความเสี่ยง",
      rain: "ฝนคาดการณ์",
      stations: "สถานีวัดน้ำ",
    },
    timeline: "เลือกช่วงเวลา",
    stations: "สถานีใกล้พื้นที่เสี่ยง",
    selectedStation: "สถานีที่เลือก",
    whatItMeans: "ความหมายสำหรับประชาชน",
    refresh: "รีเฟรชข้อมูล",
    language: "English",
    mockBanner: "ต้นแบบคลิกได้สำหรับ HFT-3 ยังไม่ใช่ประกาศฉุกเฉินจริง",
    basin: "คลองอู่ตะเภา",
    lake: "ทะเลสาบสงขลา",
  },
  en: {
    product: "Hat Yai Flood Watch",
    eyebrow: "Public prototype · U-Tapao canal and Songkhla Lake basin",
    title: "Hat Yai flood awareness dashboard",
    subtitle:
      "A public view combining forecast rain, station water levels, and practical guidance for the next 72 hours.",
    currentStatus: "Current Status",
    forecastTrend: "72h Forecast Trend",
    riskScale: "Risk Scale",
    mapTitle: "Situation Map",
    mapSubtitle: "Mock layers for forecast rain, basin risk, and water stations",
    confidence: "Confidence",
    rain: "Rainfall",
    water: "Water level",
    trend: "Trend",
    layers: {
      risk: "Risk",
      rain: "Forecast Rain",
      stations: "Water Stations",
    },
    timeline: "Forecast time",
    stations: "Stations Near Risk Areas",
    selectedStation: "Selected station",
    whatItMeans: "What this means",
    refresh: "Refresh data",
    language: "ไทย",
    mockBanner: "Clickable HFT-3 prototype. Not an official emergency notice.",
    basin: "U-Tapao canal",
    lake: "Songkhla Lake",
  },
} as const;

const forecast: ForecastStep[] = [
  { hour: "Now", rainMm: 18, level: "yellow", confidence: 76 },
  { hour: "+12h", rainMm: 42, level: "orange", confidence: 72 },
  { hour: "+24h", rainMm: 61, level: "orange", confidence: 68 },
  { hour: "+48h", rainMm: 88, level: "red", confidence: 61 },
  { hour: "+72h", rainMm: 34, level: "yellow", confidence: 58 },
];

/**
 * Mock station observation timestamps.
 *
 * These are fixed offsets from the page-load time so the stale indicator
 * behaves consistently without polling. Khlong Wa and U-Tapao Bridge have
 * recent readings; Songkhla Lake Outlet is intentionally set older than
 * `STATION_MAX_AGE_HOURS` to demonstrate the stale indicator.
 *
 * Replace these with `observedAt` values from the station API when live.
 */
const NOW = new Date();
const minutesAgo = (m: number) => new Date(NOW.getTime() - m * 60 * 1000);

const stations: Station[] = [
  {
    id: "khlong-wa",
    name: { th: "สถานีคลองหวะ", en: "Khlong Wa Station" },
    area: { th: "คอหงส์ / ตลาดหาดใหญ่", en: "Kho Hong / Hat Yai market" },
    waterLevelM: 2.8,
    trend: "rising",
    risk: "orange",
    coordinates: [100.47, 6.96],
    observedAt: minutesAgo(18),
  },
  {
    id: "utapao-bridge",
    name: { th: "สะพานคลองอู่ตะเภา", en: "U-Tapao Bridge" },
    area: { th: "หาดใหญ่ใน", en: "Hat Yai Nai" },
    waterLevelM: 3.2,
    trend: "rising",
    risk: "red",
    coordinates: [100.55, 7.03],
    observedAt: minutesAgo(45),
  },
  {
    id: "songkhla-outlet",
    name: { th: "ปากทางทะเลสาบสงขลา", en: "Songkhla Lake Outlet" },
    area: { th: "ตอนล่างลุ่มน้ำ", en: "Lower basin" },
    waterLevelM: 1.9,
    trend: "stable",
    risk: "yellow",
    coordinates: [100.62, 7.18],
    observedAt: minutesAgo(7 * 60 + 25),
  },
];

/**
 * Mock basin risk zones used by the dashboard's "Risk" map tab.
 *
 * Coordinates are approximate hand-drawn polygons covering the lower U-Tapao
 * canal stretch and the Songkhla Lake outlet. Replace with authoritative
 * basin/floodplain polygons in HFT-1.5.D when ingestion lands.
 */
const riskOverlay: RiskOverlayZone[] = [
  {
    id: "lower-utapao",
    level: "orange",
    labelEn: "Lower U-Tapao floodplain",
    labelTh: "พื้นที่น้ำท่วมตอนล่างคลองอู่ตะเภา",
    ring: [
      [100.42, 6.92],
      [100.55, 6.92],
      [100.58, 7.0],
      [100.5, 7.04],
      [100.42, 7.0],
      [100.42, 6.92],
    ],
  },
  {
    id: "hatyai-core",
    level: "red",
    labelEn: "Hat Yai municipal core",
    labelTh: "พื้นที่เทศบาลหาดใหญ่",
    ring: [
      [100.5, 7.0],
      [100.6, 7.0],
      [100.62, 7.07],
      [100.52, 7.09],
      [100.48, 7.05],
      [100.5, 7.0],
    ],
  },
  {
    id: "songkhla-outlet",
    level: "yellow",
    labelEn: "Songkhla Lake outlet",
    labelTh: "ปากทะเลสาบสงขลา",
    ring: [
      [100.58, 7.14],
      [100.7, 7.12],
      [100.74, 7.22],
      [100.62, 7.24],
      [100.56, 7.18],
      [100.58, 7.14],
    ],
  },
];

const trendLabel: Record<Station["trend"], Record<Language, string>> = {
  rising: { th: "เพิ่มขึ้น", en: "Rising" },
  stable: { th: "คงที่", en: "Stable" },
  falling: { th: "ลดลง", en: "Falling" },
};

function getStepLabel(step: ForecastStep, language: Language) {
  if (step.hour === "Now") {
    return language === "th" ? "ตอนนี้" : "Now";
  }

  return step.hour;
}

/** Lifecycle phase for the shelter directory fetch. */
type SheltersPhase = "loading" | "ready" | "empty" | "error";

interface SheltersState {
  phase: SheltersPhase;
  shelters: ReadonlyArray<Shelter>;
  retrievedDate: string | null;
  accuracyNote: string | null;
}

/**
 * Fetch the public shelter directory once on mount.
 *
 * Returns a small state machine so the UI can render distinct loading, empty,
 * ready, and error states. The fetch is aborted on unmount. Errors never throw
 * to the render tree — a failed shelter fetch must not blank the dashboard.
 */
function useShelters(): SheltersState {
  const [state, setState] = useState<SheltersState>({
    phase: "loading",
    shelters: [],
    retrievedDate: null,
    accuracyNote: null,
  });

  useEffect(() => {
    const controller = new AbortController();
    fetchShelters(controller.signal)
      .then((data) => {
        setState({
          phase: data.shelters.length === 0 ? "empty" : "ready",
          shelters: data.shelters,
          retrievedDate: data.provenance.retrieved_date,
          accuracyNote: data.provenance.accuracy_note,
        });
      })
      .catch((error: unknown) => {
        // Swallow aborts (unmount); surface every other failure as an error
        // state so the nearest-shelter card can warn rather than imply none.
        if (
          error instanceof SheltersApiClientError &&
          error.detail.kind === "aborted"
        ) {
          return;
        }
        setState({
          phase: "error",
          shelters: [],
          retrievedDate: null,
          accuracyNote: null,
        });
      });
    return () => {
      controller.abort();
    };
  }, []);

  return state;
}

/** Lifecycle phase for the approved citizen-reports fetch. */
type ReportsPhase = "loading" | "ready" | "empty" | "error";

interface ReportsState {
  phase: ReportsPhase;
  reports: ReadonlyArray<CitizenReport>;
}

/**
 * Fetch approved citizen reports and expose a small state machine plus a manual
 * reload trigger (used after a successful submission so a freshly-approved
 * report would appear once moderated).
 *
 * Errors never throw to the render tree — a failed reports fetch must not blank
 * the dashboard, and the error phase lets the UI warn rather than imply "no
 * flooding reported anywhere".
 */
function useApprovedReports(): ReportsState & { reload: () => void } {
  const [state, setState] = useState<ReportsState>({
    phase: "loading",
    reports: [],
  });
  // Bumping this re-runs the fetch effect.
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState((prev) => ({ ...prev, phase: "loading" }));
    fetchApprovedReports(undefined, controller.signal)
      .then((data) => {
        setState({
          phase: data.reports.length === 0 ? "empty" : "ready",
          reports: data.reports,
        });
      })
      .catch((error: unknown) => {
        if (
          error instanceof ReportsApiClientError &&
          error.detail.kind === "aborted"
        ) {
          return;
        }
        setState({ phase: "error", reports: [] });
      });
    return () => {
      controller.abort();
    };
  }, [reloadToken]);

  return { ...state, reload: () => setReloadToken((token) => token + 1) };
}

export function App() {
  const [language, setLanguage] = useState<Language>("th");
  const [activeLayer, setActiveLayer] = useState<MapLayer>("rain");
  const [forecastIndex, setForecastIndex] = useState(1);
  const [selectedStationId, setSelectedStationId] = useState(stations[1].id);
  const [page, setPage] = useState<"dashboard" | "history">(() =>
    window.location.pathname === "/history" ? "history" : "dashboard",
  );

  const navigateToHistory = () => {
    window.history.pushState({}, "", "/history");
    setPage("history");
  };

  const navigateToDashboard = () => {
    window.history.pushState({}, "", "/");
    setPage("dashboard");
  };

  const [riskData, setRiskData] = useState<CurrentRiskResponse | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetchCurrentRisk(controller.signal)
      .then((data) => setRiskData(data))
      .catch(() => {
        // Silently swallow: the chip simply won't render on error or abort.
        // The primary risk display is unaffected.
      });
    return () => {
      controller.abort();
    };
  }, []);

  // ---- Shelters (HFT-72) ----------------------------------------------
  const sheltersState = useShelters();
  const [showShelters, setShowShelters] = useState(false);
  const [selectedShelterId, setSelectedShelterId] = useState<string | null>(
    null,
  );
  // Device-geolocation origin as [lng, lat]; null until granted. Falls back to
  // the basin centre with explicit copy when permission is denied/unavailable.
  const [userOrigin, setUserOrigin] = useState<readonly [number, number] | null>(
    null,
  );

  // ---- Citizen reports (HFT-74) ---------------------------------------
  const reportsState = useApprovedReports();
  const [showReports, setShowReports] = useState(false);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);

  const t = copy[language];
  const currentForecast = forecast[forecastIndex];
  const currentRisk = currentForecast.level;
  // High-risk guidance (nearest shelters + geolocation prompt) is gated on the
  // current risk level: shown only at orange/red, hidden at green/yellow.
  const isHighRisk = currentRisk === "orange" || currentRisk === "red";

  // Request geolocation only when high-risk guidance is about to show, so we do
  // not prompt during calm conditions. Denial silently falls back to the city
  // centre with explicit copy.
  useEffect(() => {
    if (!isHighRisk) return;
    if (userOrigin) return;
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    let cancelled = false;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (cancelled) return;
        setUserOrigin([pos.coords.longitude, pos.coords.latitude]);
      },
      () => {
        // Denied or unavailable: keep userOrigin null -> city-centre fallback.
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
    );
    return () => {
      cancelled = true;
    };
  }, [isHighRisk, userOrigin]);
  const selectedStation = useMemo(
    () =>
      stations.find((station) => station.id === selectedStationId) ??
      stations[0],
    [selectedStationId]
  );
  const maxRain = Math.max(...forecast.map((step) => step.rainMm));

  // Live forecast frames replace the previous mock rainfall cells. The hook
  // returns ready-made overlay/sidebar/legend slots so this page can drop
  // them into the existing map and aside layouts (HFT-13). For HFT-17 we keep
  // the data-fetching responsibility here but render the actual rainfall grid
  // through MapLibre via `<BasinMap>` instead of the absolutely-positioned
  // CSS overlay.
  const rainfallForecast = useRainfallForecastSlots({
    active: activeLayer === "rain",
    language,
    provider: "gfs",
  });
  const mapCopy = FORECAST_FRAMES_COPY[language];
  const mapStations = useMemo<MapStation[]>(
    () =>
      stations.map((station) => ({
        id: station.id,
        coordinates: station.coordinates,
        risk: station.risk,
        waterLevelM: station.waterLevelM,
        trend: station.trend,
        nameEn: station.name.en,
        nameTh: station.name.th,
      })),
    [],
  );

  // Origin for nearest-shelter ranking: device location when granted, else the
  // basin/city centre. Drives both the distance copy and which copy variant we
  // show (from-you vs from-centre).
  const shelterOrigin: readonly [number, number] = userOrigin ?? BASIN_CENTER;
  const usingDeviceLocation = userOrigin !== null;
  const nearestShelterList = useMemo<ShelterWithDistance[]>(
    () =>
      sheltersState.shelters.length > 0
        ? nearestShelters(sheltersState.shelters, shelterOrigin, 3)
        : [],
    [sheltersState.shelters, shelterOrigin[0], shelterOrigin[1]],
  );
  const selectedShelter = useMemo<Shelter | null>(
    () =>
      sheltersState.shelters.find((s) => s.id === selectedShelterId) ?? null,
    [sheltersState.shelters, selectedShelterId],
  );
  const selectedReport = useMemo<CitizenReport | null>(
    () =>
      reportsState.reports.find((r) => r.id === selectedReportId) ?? null,
    [reportsState.reports, selectedReportId],
  );

  if (page === "history") {
    return (
      <main className="min-h-screen overflow-hidden bg-slate-950 text-slate-50">
        <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.24),_transparent_30%),radial-gradient(circle_at_80%_10%,_rgba(45,212,191,0.2),_transparent_26%),linear-gradient(180deg,_#07111f_0%,_#0f172a_100%)]" />
        <div className="relative mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
          <Suspense
            fallback={
              <p
                className="flex items-center justify-center gap-2 py-16 text-sm text-slate-300"
                role="status"
                aria-live="polite"
              >
                <RefreshCw className="size-4 animate-spin" aria-hidden />
                {mapCopy.loading}
              </p>
            }
          >
            <HistoricalEventList
              language={language}
              onNavigateDashboard={navigateToDashboard}
            />
          </Suspense>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen overflow-hidden bg-slate-950 text-slate-50">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.24),_transparent_30%),radial-gradient(circle_at_80%_10%,_rgba(45,212,191,0.2),_transparent_26%),linear-gradient(180deg,_#07111f_0%,_#0f172a_46%,_#f8fafc_46%,_#f8fafc_100%)]" />
      <div className="relative mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-4 sm:px-6 lg:px-8">
        <header className="rounded-[2rem] border border-white/10 bg-white/10 p-4 shadow-2xl shadow-cyan-950/30 backdrop-blur sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-2 rounded-full border border-cyan-200/30 bg-cyan-200/10 px-3 py-1 text-xs font-semibold text-cyan-100">
                  <Waves className="size-3.5" />
                  {t.product as string}
                </span>
                <span className="rounded-full border border-amber-200/30 bg-amber-200/10 px-3 py-1 text-xs font-medium text-amber-100">
                  {t.mockBanner as string}
                </span>
              </div>
              <p className="text-sm font-medium text-cyan-100/90">
                {t.eyebrow as string}
              </p>
              <h1 className="mt-3 text-4xl font-black tracking-tight text-white sm:text-5xl lg:text-6xl">
                {t.title as string}
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-200 sm:text-lg">
                {t.subtitle as string}
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
              <Button
                type="button"
                className="rounded-full bg-white text-slate-950 hover:bg-cyan-50"
                onClick={() =>
                  setLanguage((current) => (current === "th" ? "en" : "th"))
                }
              >
                <Languages className="size-4" />
                {t.language as string}
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="rounded-full border border-white/20 bg-white/10 text-white hover:bg-white/20"
                onClick={() => rainfallForecast.refresh()}
                disabled={rainfallForecast.isFetching}
              >
                <RefreshCw
                  className={cn(
                    "size-4",
                    rainfallForecast.isFetching && "animate-spin",
                  )}
                />
                {t.refresh as string}
              </Button>
              <Button
                type="button"
                className="rounded-full bg-sky-600 text-white hover:bg-sky-500"
                onClick={() => setReportDialogOpen(true)}
                aria-label={mapCopy.reportEntryAria}
              >
                <Megaphone className="size-4" />
                {mapCopy.reportEntry}
              </Button>
              <AlertSubscriptionButton language={language} copy={mapCopy} />
            </div>
          </div>
        </header>

        <PrimaryDataBanner
          phase={rainfallForecast.phase}
          isFetching={rainfallForecast.isFetching}
          onRetry={() => rainfallForecast.refresh()}
          mapCopy={mapCopy}
        />

        <section className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
          <Card className="overflow-hidden border-0 bg-white text-slate-950 shadow-xl">
            <CardHeader className="gap-3 pb-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardDescription className="font-semibold uppercase tracking-[0.2em] text-slate-500">
                    {t.currentStatus as string}
                  </CardDescription>
                  <CardTitle className="mt-2 text-2xl font-black">
                    {riskMeta[currentRisk].meaning[language]}
                  </CardTitle>
                </div>
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-bold",
                    riskMeta[currentRisk].badgeClass
                  )}
                  aria-label={`${riskMeta[currentRisk].label[language]} — ${mapCopy.riskLevelOrdinal(
                    riskOrder.indexOf(currentRisk) + 1,
                    riskOrder.length,
                  )}`}
                >
                  {(() => {
                    const RiskIcon = riskMeta[currentRisk].Icon;
                    return <RiskIcon className="size-4 shrink-0" aria-hidden />;
                  })()}
                  {riskMeta[currentRisk].label[language]}
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <div
                className={cn(
                  "rounded-[1.75rem] bg-gradient-to-br p-5 text-white shadow-lg",
                  riskMeta[currentRisk].panelClass
                )}
              >
                <div className="flex items-start gap-4">
                  <div className="rounded-2xl bg-white/20 p-3">
                    {(() => {
                      const RiskIcon = riskMeta[currentRisk].Icon;
                      return <RiskIcon className="size-7" aria-hidden />;
                    })()}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white/80">
                      {t.whatItMeans as string}
                    </p>
                    <p className="mt-1 text-2xl font-black leading-tight">
                      {riskMeta[currentRisk].action[language]}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <MetricTile
                  icon={<CloudRain className="size-4" />}
                  label={t.rain as string}
                  value={`${currentForecast.rainMm} mm`}
                />
                <MetricTile
                  icon={<Gauge className="size-4" />}
                  label={t.confidence as string}
                  value={`${currentForecast.confidence}%`}
                />
                <MetricTile
                  icon={<Droplets className="size-4" />}
                  label={t.water as string}
                  value={`${selectedStation.waterLevelM.toFixed(1)} m`}
                />
              </div>

              <ForecastDataStateRow
                phase={rainfallForecast.phase}
                freshness={rainfallForecast.freshness}
                language={language}
                mapCopy={mapCopy}
              />

              <ProviderEnsembleChip riskData={riskData} mapCopy={mapCopy} />
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-slate-900/90 text-white shadow-xl shadow-slate-950/30">
            <CardHeader>
              <CardDescription className="font-semibold uppercase tracking-[0.2em] text-cyan-200">
                {t.forecastTrend as string}
              </CardDescription>
              <CardTitle className="text-2xl font-black">
                {getStepLabel(currentForecast, language)} ·{" "}
                {riskMeta[currentRisk].label[language]}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex items-end gap-2 rounded-3xl bg-white/5 p-4">
                {forecast.map((step, index) => (
                  <button
                    type="button"
                    key={step.hour}
                    className={cn(
                      "group flex min-h-44 flex-1 flex-col justify-end gap-2 rounded-2xl border border-white/10 p-2 text-left transition hover:bg-white/10",
                      index === forecastIndex && "bg-white/10 ring-2 ring-cyan-300"
                    )}
                    onClick={() => setForecastIndex(index)}
                  >
                    <div
                      className={cn(
                        "w-full rounded-xl border transition-all",
                        riskMeta[step.level].mapClass
                      )}
                      style={
                        {
                          height: `${Math.max(24, (step.rainMm / maxRain) * 116)}px`,
                        } satisfies CSSProperties
                      }
                    />
                    <span className="text-xs font-bold text-white">
                      {getStepLabel(step, language)}
                    </span>
                    <span className="text-[11px] text-slate-300">
                      {step.rainMm} mm
                    </span>
                  </button>
                ))}
              </div>

              <label className="block rounded-3xl border border-white/10 bg-white/5 p-4">
                <span className="flex items-center justify-between text-sm font-semibold text-slate-200">
                  {t.timeline as string}
                  <span>{getStepLabel(currentForecast, language)}</span>
                </span>
                <input
                  type="range"
                  min={0}
                  max={forecast.length - 1}
                  value={forecastIndex}
                  onChange={(event) =>
                    setForecastIndex(Number(event.currentTarget.value))
                  }
                  className="mt-4 w-full accent-cyan-300"
                />
              </label>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
          <Card className="overflow-hidden border-0 bg-white text-slate-950 shadow-xl">
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <CardDescription className="font-semibold uppercase tracking-[0.2em] text-slate-500">
                    {t.mapTitle as string}
                  </CardDescription>
                  <CardTitle className="mt-2 text-2xl font-black">
                    {t.basin as string} / {t.lake as string}
                  </CardTitle>
                  <p className="mt-2 max-w-2xl text-sm text-slate-600">
                    {t.mapSubtitle as string}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex rounded-full bg-slate-100 p-1">
                    {(["risk", "rain", "stations"] satisfies MapLayer[]).map(
                      (layer) => (
                        <button
                          type="button"
                          key={layer}
                          onClick={() => setActiveLayer(layer)}
                          className={cn(
                            "inline-flex min-h-11 items-center gap-1 rounded-full px-3.5 py-2 text-xs font-bold transition",
                            activeLayer === layer
                              ? "bg-slate-950 text-white shadow"
                              : "text-slate-600 hover:bg-white"
                          )}
                        >
                          <Layers className="size-3.5" />
                          {t.layers[layer]}
                        </button>
                      )
                    )}
                  </div>
                  {/* Shelters are a persistent overlay independent of the
                      mutually-exclusive layer tabs, so they stay visible across
                      risk/rain/stations. Disabled until the directory loads. */}
                  <button
                    type="button"
                    onClick={() => setShowShelters((on) => !on)}
                    disabled={sheltersState.phase !== "ready"}
                    aria-pressed={showShelters}
                    aria-label={mapCopy.shelterToggleAria}
                    className={cn(
                      "inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-50",
                      showShelters
                        ? "border-indigo-900 bg-indigo-900 text-white shadow"
                        : "border-indigo-200 bg-white text-indigo-900 hover:bg-indigo-50"
                    )}
                  >
                    <Home className="size-3.5" />
                    {mapCopy.shelterToggle}
                  </button>
                  {/* Citizen reports: persistent overlay independent of the
                      layer tabs, like shelters. Uses a sky/blue accent to match
                      the report depth scale and stay clear of the risk palette
                      and the indigo shelter markers. Disabled until reports are
                      ready (loading/empty/error keep it off). */}
                  <button
                    type="button"
                    onClick={() => setShowReports((on) => !on)}
                    disabled={reportsState.phase !== "ready"}
                    aria-pressed={showReports}
                    aria-label={mapCopy.reportsToggleAria}
                    className={cn(
                      "inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-50",
                      showReports
                        ? "border-sky-600 bg-sky-600 text-white shadow"
                        : "border-sky-200 bg-white text-sky-700 hover:bg-sky-50",
                    )}
                  >
                    <Megaphone className="size-3.5" />
                    {mapCopy.reportsToggle}
                  </button>
                  {/* Feed status for the citizen-reports layer. The toggle pill
                      above is disabled in loading/empty/error states; this line
                      tells users *why* the layer is unavailable so an empty or
                      failed feed never reads as "no flooding anywhere". Renders
                      nothing once reports are ready. */}
                  <ReportsFeedStatus
                    phase={reportsState.phase}
                    mapCopy={mapCopy}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div
                className="relative min-h-[420px] overflow-hidden rounded-[2rem] border border-slate-200 bg-slate-100"
                data-testid="basin-map-shell"
              >
                <MapErrorBoundary copy={mapCopy}>
                  <BasinMap
                    rainfallFrames={rainfallForecast.frames}
                    selectedRainfallFrame={rainfallForecast.visibleFrame}
                    stations={mapStations}
                    riskOverlay={riskOverlay}
                    shelters={sheltersState.shelters}
                    showShelters={showShelters}
                    reports={reportsState.reports}
                    showReports={showReports}
                    activeLayer={activeLayer}
                    selectedStationId={selectedStationId}
                    language={language}
                    copy={mapCopy}
                    onSelectStation={(stationId) => {
                      setSelectedStationId(stationId);
                      setActiveLayer("stations");
                    }}
                    onSelectShelter={(shelterId) => {
                      setSelectedShelterId(shelterId);
                      setShowShelters(true);
                    }}
                    onSelectReport={(reportId) => {
                      setSelectedReportId(reportId);
                      setShowReports(true);
                    }}
                  />
                </MapErrorBoundary>

                {activeLayer === "rain" && (
                  <div
                    className="pointer-events-none absolute inset-x-3 top-3 z-10"
                    data-testid="forecast-rainfall-overlay"
                  >
                    {rainfallForecast.overlay}
                  </div>
                )}

                {/* On-map shelter selection popup. Shown when a shelter marker
                    (or a nearest-shelter row) is selected; dismissible. */}
                {showShelters && selectedShelter && (
                  <div
                    className="absolute left-3 right-3 top-3 z-20 rounded-2xl border border-indigo-200 bg-white/95 p-3 shadow-xl backdrop-blur"
                    data-testid="shelter-popup"
                    role="dialog"
                    aria-label={mapCopy.shelterToggle}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="flex items-center gap-1.5 text-sm font-black text-slate-900">
                          <Home className="size-4 text-indigo-900" aria-hidden />
                          {language === "th"
                            ? selectedShelter.name_th
                            : selectedShelter.name_en}
                        </p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-2">
                          <ShelterTypeChip
                            type={selectedShelter.type}
                            mapCopy={mapCopy}
                          />
                          <span className="text-xs text-slate-600">
                            {selectedShelter.capacity !== null
                              ? mapCopy.shelterCapacity(selectedShelter.capacity)
                              : mapCopy.shelterCapacityUnknown}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-500">
                          {selectedShelter.municipality_th}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedShelterId(null)}
                        aria-label={language === "th" ? "ปิด" : "Close"}
                        className="flex size-11 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                      >
                        <span aria-hidden className="text-lg leading-none">
                          ×
                        </span>
                      </button>
                    </div>
                    {sheltersState.retrievedDate && (
                      <p className="mt-2 text-[10px] text-slate-600">
                        {mapCopy.shelterDatasetDate(
                          sheltersState.retrievedDate,
                        )}
                      </p>
                    )}
                  </div>
                )}

                {/* On-map citizen-report selection popup. Shows reported depth,
                    note, an optional photo thumbnail, and relative time. */}
                {showReports && selectedReport && (
                  <ReportPopup
                    report={selectedReport}
                    language={language}
                    mapCopy={mapCopy}
                    onClose={() => setSelectedReportId(null)}
                  />
                )}

                <div className="pointer-events-none absolute bottom-3 left-3 right-3 z-10 rounded-3xl border border-white/70 bg-white/90 p-3 shadow-xl backdrop-blur">
                  <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                    {riskOrder.map((level, index) => (
                      <div key={level} className="flex items-center gap-2">
                        <RiskGlyph
                          level={level}
                          ordinal={index + 1}
                          language={language}
                          mapCopy={mapCopy}
                        />
                        <span className="font-semibold text-slate-700">
                          {riskMeta[level].label[language]}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Citizen-report depth key, shown only when the reports layer
                      is on. The blue circles are graduated by depth — color
                      alone is not a reliable channel, so each step carries its
                      depth text label and a size cue (shallow -> deep). */}
                  {showReports && (
                    <div
                      className="mt-2 border-t border-slate-200/70 pt-2"
                      data-testid="reports-depth-legend"
                    >
                      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-600">
                        {mapCopy.reportsLegendTitle}
                      </p>
                      <div className="mt-1 grid grid-cols-2 gap-1.5 text-xs sm:grid-cols-4">
                        {WaterDepthValues.map((depth, depthIndex) => (
                          <div key={depth} className="flex items-center gap-2">
                            <span
                              className="shrink-0 rounded-full border border-white shadow-sm"
                              style={{
                                backgroundColor: REPORT_DEPTH_COLORS[depth],
                                width: `${8 + depthIndex * 3}px`,
                                height: `${8 + depthIndex * 3}px`,
                              }}
                              aria-hidden
                            />
                            <span className="font-semibold text-slate-700">
                              {mapCopy.reportDepthLabels[depth]}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <p className="mt-2 text-[10px] uppercase tracking-wide text-slate-600">
                    {mapCopy.mapAttributionLabel}: {mapCopy.mapTileAttribution}
                  </p>
                  <p className="text-[10px] text-slate-600">
                    {mapCopy.mapTileLicense}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <aside className="grid gap-4">
            <NearestSheltersCard
              isHighRisk={isHighRisk}
              phase={sheltersState.phase}
              nearest={nearestShelterList}
              usingDeviceLocation={usingDeviceLocation}
              retrievedDate={sheltersState.retrievedDate}
              accuracyNote={sheltersState.accuracyNote}
              selectedShelterId={selectedShelterId}
              onSelectShelter={(id) => {
                setSelectedShelterId(id);
                setShowShelters(true);
              }}
              language={language}
              mapCopy={mapCopy}
            />
            <Card className="border-0 bg-white text-slate-950 shadow-xl">
              <CardHeader>
                <CardDescription className="font-semibold uppercase tracking-[0.2em] text-slate-500">
                  {language === "th" ? "ฝนคาดการณ์ (ข้อมูลจริง)" : "Forecast Rainfall (Live)"}
                </CardDescription>
                <CardTitle className="text-2xl font-black">
                  {language === "th" ? "GFS · ลุ่มน้ำคลองอู่ตะเภา" : "GFS · U-Tapao Basin"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {rainfallForecast.sidebar}
                {rainfallForecast.legend}
              </CardContent>
            </Card>

            <Card className="border-0 bg-white text-slate-950 shadow-xl">
              <CardHeader>
                <CardDescription className="font-semibold uppercase tracking-[0.2em] text-slate-500">
                  {t.selectedStation as string}
                </CardDescription>
                <CardTitle className="text-2xl font-black">
                  {selectedStation.name[language]}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="flex items-center gap-2 text-sm text-slate-600">
                  <MapPin className="size-4" />
                  {selectedStation.area[language]}
                </p>
                <StationObservationRow
                  observedAt={selectedStation.observedAt}
                  language={language}
                  mapCopy={mapCopy}
                />
                <div className="grid grid-cols-2 gap-3">
                  <MetricTile
                    icon={<Droplets className="size-4" />}
                    label={t.water as string}
                    value={`${selectedStation.waterLevelM.toFixed(1)} m`}
                  />
                  <MetricTile
                    icon={<Waves className="size-4" />}
                    label={t.trend as string}
                    value={trendLabel[selectedStation.trend][language]}
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 bg-white text-slate-950 shadow-xl">
              <CardHeader>
                <CardDescription className="font-semibold uppercase tracking-[0.2em] text-slate-500">
                  {t.riskScale as string}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {riskOrder.map((level, index) => (
                  <button
                    type="button"
                    key={level}
                    className="w-full rounded-2xl border border-slate-200 p-3 text-left transition hover:border-slate-400 hover:bg-slate-50"
                    onClick={() => {
                      const stepIndex = forecast.findIndex(
                        (step) => step.level === level
                      );
                      if (stepIndex >= 0) {
                        setForecastIndex(stepIndex);
                      }
                    }}
                  >
                    <span className="flex items-center gap-2 font-black">
                      <RiskGlyph
                        level={level}
                        ordinal={index + 1}
                        language={language}
                        mapCopy={mapCopy}
                      />
                      {riskMeta[level].label[language]}
                    </span>
                    <span className="mt-1 block text-sm text-slate-600">
                      {riskMeta[level].meaning[language]}
                    </span>
                  </button>
                ))}
              </CardContent>
            </Card>
          </aside>
        </section>

        {/* HFT-57 — footer link to historical events */}
        <footer className="pb-4 text-center">
          <button
            type="button"
            className="text-xs text-slate-400 hover:text-cyan-300 transition-colors"
            onClick={navigateToHistory}
          >
            {language === "th"
              ? "เหตุการณ์น้ำท่วมย้อนหลัง"
              : "Historical flood events"}
          </button>
        </footer>
      </div>

      <ReportFloodingDialog
        open={reportDialogOpen}
        onClose={() => setReportDialogOpen(false)}
        language={language}
        copy={mapCopy}
        onSubmitted={() => {
          // Refetch approved reports. A freshly-submitted report stays pending
          // until moderated, so it will not appear immediately — the reload
          // keeps the layer current with whatever is already approved.
          reportsState.reload();
        }}
      />
    </main>
  );
}

/**
 * Color-independent risk marker used in the map legend and the risk-scale list.
 *
 * Satisfies WCAG SC 1.4.1 (Use of Color): the canonical risk hue is one of
 * three redundant channels — a colored chip carries (1) the per-level escalation
 * icon shape and (2) the ordinal number glyph, with (3) an accessible
 * "Level N of 4" label for assistive tech. Color-blind users distinguish the
 * four levels by icon and number, not hue alone.
 */
function RiskGlyph({
  level,
  ordinal,
  language,
  mapCopy,
}: {
  level: RiskLevel;
  ordinal: number;
  language: Language;
  mapCopy: (typeof FORECAST_FRAMES_COPY)[Language];
}) {
  const { Icon, glyph, dotClass } = riskMeta[level];
  return (
    <span
      className={cn(
        "inline-flex size-5 shrink-0 items-center justify-center rounded-full text-white",
        dotClass,
      )}
      role="img"
      aria-label={`${riskMeta[level].label[language]} — ${mapCopy.riskLevelOrdinal(
        ordinal,
        riskOrder.length,
      )}`}
      title={mapCopy.riskLevelOrdinal(ordinal, riskOrder.length)}
    >
      <Icon className="size-3" aria-hidden />
      <span className="sr-only">{glyph}</span>
    </span>
  );
}

/**
 * Inline status for the citizen-reports map layer, shown beside the toggle pill.
 *
 * The reports toggle is disabled in every non-ready phase, which on its own is
 * silent. This line explains the disabled state — loading, empty, or error — so
 * an unavailable feed never lets the map imply "no flooding reported anywhere".
 * Renders nothing in the ready phase (the toggle is then enabled and explains
 * itself). Wires up the previously-unused `reportsLoading`/`reportsEmpty`/
 * `reportsError` i18n keys.
 */
function ReportsFeedStatus({
  phase,
  mapCopy,
}: {
  phase: ReportsPhase;
  mapCopy: (typeof FORECAST_FRAMES_COPY)[Language];
}) {
  if (phase === "ready") {
    return null;
  }

  const label =
    phase === "loading"
      ? mapCopy.reportsLoading
      : phase === "empty"
        ? mapCopy.reportsEmpty
        : mapCopy.reportsError;
  const isError = phase === "error";

  return (
    <p
      className={cn(
        "basis-full text-xs",
        isError ? "font-semibold text-red-700" : "text-slate-600",
      )}
      role={isError ? "alert" : "status"}
      aria-live="polite"
    >
      {label}
    </p>
  );
}

function MetricTile({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500">
        {icon}
        {label}
      </div>
      <p className="mt-2 text-xl font-black text-slate-950">{value}</p>
    </div>
  );
}

function DataState({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <div className="flex items-start gap-2 text-sm text-slate-600">
      <span className="mt-0.5 text-cyan-700">{icon}</span>
      <span>{label}</span>
    </div>
  );
}

/**
 * Maximum acceptable age (hours) for a station observation before the UI flags
 * it stale. Mirrors the backend `risk_water_station_max_age_hours` setting.
 *
 * Stations are still mock in this build (HFT-25 station endpoint not landed),
 * so the value is a typed default rather than a live config read. When the
 * station API ships, source this from that response and drop the constant.
 */
const STATION_MAX_AGE_HOURS = 6;
const STATION_STALE_THRESHOLD_MS = STATION_MAX_AGE_HOURS * 60 * 60 * 1000;

/**
 * Replaces the hard-coded DataState row in the risk card with live forecast
 * freshness, a source label, and an error indicator when the API fails.
 *
 * Renders three cells to match the original 3-column grid layout.
 */
function ForecastDataStateRow({
  phase,
  freshness,
  language,
  mapCopy,
}: {
  phase: ForecastFramesPhase;
  freshness: ForecastFreshness | null;
  language: Language;
  mapCopy: (typeof FORECAST_FRAMES_COPY)[Language];
}) {
  const statusLabel = freshnessLabel(freshness?.status, mapCopy);
  const retrievedAt = freshness?.retrievedAt
    ? formatDateTime(freshness.retrievedAt, language as ForecastLanguage)
    : null;

  const isError = phase === "error";
  const isStale = phase === "stale" || freshness?.status === "stale" || freshness?.status === "delayed";

  return (
    <div
      className={cn(
        "grid gap-3 rounded-3xl border p-4 sm:grid-cols-3",
        isError
          ? "border-red-200 bg-red-50"
          : isStale
            ? "border-orange-200 bg-orange-50"
            : "border-slate-200 bg-slate-50",
      )}
      role="status"
      aria-live="polite"
    >
      {/* Freshness cell */}
      <DataState
        icon={
          isError ? (
            <WifiOff className="size-4 text-red-600" />
          ) : (
            <ShieldCheck className={cn("size-4", isStale ? "text-orange-600" : "text-cyan-700")} />
          )
        }
        label={
          isError
            ? mapCopy.forecastErrorRow
            : mapCopy.forecastFreshnessRow(statusLabel)
        }
      />

      {/* Retrieved-at / loading cell */}
      <DataState
        icon={<Clock3 className="size-4" />}
        label={
          phase === "loading"
            ? mapCopy.loading
            : retrievedAt
              ? `${mapCopy.freshnessRetrievedAt}: ${retrievedAt}`
              : mapCopy.freshnessUnknown
        }
      />

      {/* Source cell */}
      <DataState
        icon={<RadioTower className="size-4" />}
        label={mapCopy.dataSource}
      />
    </div>
  );
}

/**
 * Page-level public-safety banner for the primary forecast feed.
 *
 * Renders an unmissable bilingual banner directly under the header when the
 * live forecast is in `error` (with a retry button) or `stale` (last good data
 * still shown elsewhere on the page). It is deliberately load-bearing: a failed
 * or stale feed must never let the page imply an all-clear, so the banner sits
 * above the fold rather than only inside the forecast aside. Renders nothing
 * for healthy/loading/idle phases.
 */
function PrimaryDataBanner({
  phase,
  isFetching,
  onRetry,
  mapCopy,
}: {
  phase: ForecastFramesPhase;
  isFetching: boolean;
  onRetry: () => void;
  mapCopy: (typeof FORECAST_FRAMES_COPY)[Language];
}) {
  if (phase === "error") {
    return (
      <div
        className="flex flex-col gap-3 rounded-3xl border border-red-300/70 bg-red-50 p-4 text-red-900 shadow-lg sm:flex-row sm:items-center sm:justify-between"
        role="alert"
      >
        <div className="flex items-start gap-3">
          <WifiOff className="mt-0.5 size-5 shrink-0 text-red-600" aria-hidden />
          <div>
            <p className="text-sm font-black">{mapCopy.primaryErrorBanner}</p>
            <p className="mt-0.5 text-sm">{mapCopy.primaryErrorBannerDetail}</p>
          </div>
        </div>
        <Button
          type="button"
          onClick={onRetry}
          disabled={isFetching}
          className="shrink-0 self-start rounded-full bg-red-600 text-white hover:bg-red-500 sm:self-center"
        >
          <RefreshCw
            className={cn("size-4", isFetching && "animate-spin")}
            aria-hidden
          />
          {mapCopy.errorRetry}
        </Button>
      </div>
    );
  }

  if (phase === "stale") {
    return (
      <div
        className="flex flex-col gap-3 rounded-3xl border border-orange-300/70 bg-orange-50 p-4 text-orange-900 shadow-lg sm:flex-row sm:items-center sm:justify-between"
        role="status"
        aria-live="polite"
      >
        <div className="flex items-start gap-3">
          <AlertTriangle
            className="mt-0.5 size-5 shrink-0 text-orange-600"
            aria-hidden
          />
          <div>
            <p className="text-sm font-black">{mapCopy.primaryStaleBanner}</p>
            <p className="mt-0.5 text-sm">{mapCopy.primaryStaleBannerDetail}</p>
          </div>
        </div>
        <Button
          type="button"
          variant="secondary"
          onClick={onRetry}
          disabled={isFetching}
          className="shrink-0 self-start rounded-full border border-orange-300 bg-white text-orange-900 hover:bg-orange-100 sm:self-center"
        >
          <RefreshCw
            className={cn("size-4", isFetching && "animate-spin")}
            aria-hidden
          />
          {mapCopy.errorRetry}
        </Button>
      </div>
    );
  }

  return null;
}

/**
 * Shows the station's last observation timestamp and a stale chip when the
 * reading is older than STATION_STALE_THRESHOLD_MS.
 */
function StationObservationRow({
  observedAt,
  language,
  mapCopy,
}: {
  observedAt: Date;
  language: Language;
  mapCopy: (typeof FORECAST_FRAMES_COPY)[Language];
}) {
  const isStale = Date.now() - observedAt.getTime() > STATION_STALE_THRESHOLD_MS;
  const formattedTime = formatDateTime(observedAt, language as ForecastLanguage);

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
      <Clock3 className="size-4 shrink-0" aria-hidden />
      <span>
        {mapCopy.stationObservedAt}: {formattedTime}
      </span>
      {isStale && (
        <span
          className="inline-flex items-center gap-1 rounded-full border border-orange-300 bg-orange-50 px-2 py-0.5 text-xs font-bold text-orange-800"
          title={mapCopy.stationStaleDetail(STATION_MAX_AGE_HOURS)}
          role="status"
        >
          <span className="size-1.5 rounded-full bg-orange-500" aria-hidden />
          {mapCopy.stationStaleChip}
        </span>
      )}
    </div>
  );
}

/** Determine the chip variant from the risk API response. */
type EnsembleVariant = "agree" | "differ" | "single";

function resolveEnsembleVariant(
  riskData: CurrentRiskResponse,
): EnsembleVariant | null {
  const freshProviders: ProviderResult[] = riskData.providers.filter(
    (p) => p.freshness_status === "fresh" || p.freshness_status === "delayed",
  );

  if (freshProviders.length === 0) {
    return null;
  }

  if (riskData.single_provider_warning) {
    return "single";
  }

  if (freshProviders.length >= 2) {
    const firstLevel = freshProviders[0].computed_risk_level;
    const allAgree = freshProviders.every((p) => p.computed_risk_level === firstLevel);
    return allAgree ? "agree" : "differ";
  }

  return "single";
}

/**
 * Small informational chip displayed below the risk card data-state row.
 * Shows model count and agreement status from the risk ensemble response.
 * Renders nothing when no providers are available or data has not loaded yet.
 */
function ProviderEnsembleChip({
  riskData,
  mapCopy,
}: {
  riskData: CurrentRiskResponse | null;
  mapCopy: (typeof FORECAST_FRAMES_COPY)[Language];
}) {
  if (riskData === null) {
    return null;
  }

  const variant = resolveEnsembleVariant(riskData);
  if (variant === null) {
    return null;
  }

  const labelMap: Record<EnsembleVariant, string> = {
    agree: mapCopy.ensembleBothAgree,
    differ: mapCopy.ensembleBothDiffer,
    single: mapCopy.ensembleSingleProvider,
  };

  const classMap: Record<EnsembleVariant, string> = {
    agree: "border-slate-200 bg-slate-50 text-slate-600",
    differ: "border-slate-200 bg-slate-50 text-slate-600",
    single: "border-amber-300 bg-amber-50 text-amber-800",
  };

  const dotClassMap: Record<EnsembleVariant, string> = {
    agree: "bg-slate-400",
    differ: "bg-slate-400",
    single: "bg-amber-500",
  };

  return (
    <div className="flex">
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
          classMap[variant],
        )}
        role="status"
        aria-label={labelMap[variant]}
      >
        <span
          className={cn("size-1.5 rounded-full", dotClassMap[variant])}
          aria-hidden
        />
        {labelMap[variant]}
      </span>
    </div>
  );
}

/**
 * Format a kilometre distance for display: metres under 1 km, one decimal
 * otherwise. Keeps the public copy readable rather than showing "0.3194 km".
 */
function formatDistance(km: number, language: Language): string {
  if (km < 1) {
    const m = Math.round(km * 1000);
    return language === "th" ? `${m} ม.` : `${m} m`;
  }
  return km.toFixed(1);
}

/**
 * Localized facility-type chip for a shelter.
 */
function ShelterTypeChip({
  type,
  mapCopy,
}: {
  type: ShelterType;
  mapCopy: (typeof FORECAST_FRAMES_COPY)[Language];
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[11px] font-bold text-indigo-900">
      <Home className="size-3" aria-hidden />
      {mapCopy.shelterTypeLabels[type]}
    </span>
  );
}

/**
 * Nearest-shelter public-safety guidance.
 *
 * Renders only at orange/red risk (hidden entirely at green/yellow per the
 * card). Surfaces loading, empty, and error states so a failed shelter fetch
 * never reads as "no shelters". Distances come from device geolocation when
 * granted, otherwise from the city centre with an explicit note. Dataset
 * freshness and the coordinate accuracy note are shown accessibly.
 */
function NearestSheltersCard({
  isHighRisk,
  phase,
  nearest,
  usingDeviceLocation,
  retrievedDate,
  accuracyNote,
  selectedShelterId,
  onSelectShelter,
  language,
  mapCopy,
}: {
  isHighRisk: boolean;
  phase: SheltersPhase;
  nearest: ReadonlyArray<ShelterWithDistance>;
  usingDeviceLocation: boolean;
  retrievedDate: string | null;
  accuracyNote: string | null;
  selectedShelterId: string | null;
  onSelectShelter: (shelterId: string) => void;
  language: Language;
  mapCopy: (typeof FORECAST_FRAMES_COPY)[Language];
}) {
  // Hidden entirely outside high-risk conditions.
  if (!isHighRisk) {
    return null;
  }

  return (
    <Card
      className="border-0 bg-white text-slate-950 shadow-xl ring-2 ring-indigo-900/10"
      data-testid="nearest-shelters-card"
    >
      <CardHeader className="pb-3">
        <CardDescription className="flex items-center gap-2 font-semibold uppercase tracking-[0.2em] text-indigo-900">
          <Navigation className="size-4" aria-hidden />
          {mapCopy.nearestSheltersTitle}
        </CardDescription>
        <CardTitle className="sr-only">{mapCopy.nearestSheltersTitle}</CardTitle>
        <p className="text-sm text-slate-600">{mapCopy.nearestSheltersSubtitle}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {phase === "loading" && (
          <p className="text-sm text-slate-500" role="status" aria-live="polite">
            {mapCopy.sheltersLoading}
          </p>
        )}

        {phase === "error" && (
          <p
            className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-800"
            role="alert"
          >
            {mapCopy.sheltersError}
          </p>
        )}

        {phase === "empty" && (
          <p className="text-sm text-slate-500" role="status">
            {mapCopy.sheltersEmpty}
          </p>
        )}

        {phase === "ready" && nearest.length > 0 && (
          <>
            {!usingDeviceLocation && (
              <p className="flex items-start gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-600">
                <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                {mapCopy.distanceCenterNote}
              </p>
            )}
            <ul className="space-y-2">
              {nearest.map(({ shelter, distanceKm }) => {
                const isSelected = shelter.id === selectedShelterId;
                const distanceText = formatDistance(distanceKm, language);
                return (
                  <li key={shelter.id}>
                    <button
                      type="button"
                      onClick={() => onSelectShelter(shelter.id)}
                      className={cn(
                        "w-full rounded-2xl border p-3 text-left transition",
                        isSelected
                          ? "border-indigo-900 bg-indigo-50"
                          : "border-slate-200 hover:border-indigo-300 hover:bg-slate-50",
                      )}
                    >
                      <span className="flex items-start justify-between gap-2">
                        <span className="font-bold leading-tight text-slate-900">
                          {language === "th" ? shelter.name_th : shelter.name_en}
                        </span>
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-indigo-900 px-2 py-0.5 text-[11px] font-bold text-white">
                          <Navigation className="size-3" aria-hidden />
                          {usingDeviceLocation
                            ? mapCopy.distanceFromYou(distanceText)
                            : mapCopy.distanceFromCenter(distanceText)}
                        </span>
                      </span>
                      <span className="mt-1.5 flex flex-wrap items-center gap-2">
                        <ShelterTypeChip type={shelter.type} mapCopy={mapCopy} />
                        <span className="text-xs text-slate-600">
                          {shelter.capacity !== null
                            ? mapCopy.shelterCapacity(shelter.capacity)
                            : mapCopy.shelterCapacityUnknown}
                        </span>
                      </span>
                      <span className="mt-1 block text-xs text-slate-500">
                        {shelter.municipality_th}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>

            {/* Dataset freshness + coordinate accuracy note, accessible. */}
            {retrievedDate && (
              <p className="text-[11px] text-slate-600">
                {mapCopy.shelterDatasetDate(retrievedDate)}
              </p>
            )}
            {accuracyNote && (
              <details className="text-[11px] text-slate-600">
                <summary className="cursor-pointer font-semibold text-slate-600">
                  {mapCopy.shelterAccuracyNote}
                </summary>
                <p className="mt-1 leading-snug">{accuracyNote}</p>
              </details>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * On-map popup for a selected citizen flood report.
 *
 * Renders the reported water depth, the optional note, a photo thumbnail when
 * one is attached (resolved against the API origin), and a relative-time line.
 * Uses the same sky/blue accent as the report map layer so the popup reads as a
 * citizen observation, distinct from the indigo shelter popup.
 */
function ReportPopup({
  report,
  language,
  mapCopy,
  onClose,
}: {
  report: CitizenReport;
  language: Language;
  mapCopy: (typeof FORECAST_FRAMES_COPY)[Language];
  onClose: () => void;
}) {
  const depthLabel = mapCopy.reportDepthLabels[report.water_depth as WaterDepth];
  const relative = formatRelativeTime(report.created_at, mapCopy);
  const photoSrc = resolveReportPhotoUrl(report.photo_url);

  return (
    <div
      className="absolute left-3 right-3 top-3 z-20 rounded-2xl border border-sky-200 bg-white/95 p-3 shadow-xl backdrop-blur"
      data-testid="report-popup"
      role="dialog"
      aria-label={mapCopy.reportPopupTitle}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-sm font-black text-slate-900">
            <Waves className="size-4 text-sky-600" aria-hidden />
            {mapCopy.reportPopupTitle}
          </p>
          <p className="mt-1 text-xs font-bold text-sky-800">
            {mapCopy.reportPopupDepth(depthLabel)}
          </p>
          {report.note && (
            <p className="mt-1 break-words text-xs text-slate-600">
              {report.note}
            </p>
          )}
          {relative && (
            <p className="mt-1 text-[11px] text-slate-600">
              {mapCopy.reportPopupTime(relative)}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={language === "th" ? "ปิด" : "Close"}
          className="flex size-11 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-700"
        >
          <span aria-hidden className="text-lg leading-none">
            ×
          </span>
        </button>
      </div>
      {report.has_photo && photoSrc && (
        <img
          src={photoSrc}
          alt={mapCopy.reportPhotoAlt}
          loading="lazy"
          className="mt-2 h-32 w-full rounded-xl border border-slate-200 object-cover"
        />
      )}
    </div>
  );
}

export default App;
