/**
 * Translation-ready copy for the forecast frames UI.
 *
 * Keep all forecast-frames-specific strings here so we can swap to a richer
 * i18n library without grep-replacing across components.
 */

import type { ForecastFreshnessStatus } from "@/lib/api/forecastFrames";

export type Language = "th" | "en";

export interface ForecastFramesCopy {
  layerLabel: string;
  layerSubtitle: string;
  noFrames: string;
  loading: string;
  loadingDetail: string;
  errorTitle: string;
  errorRetry: string;
  errorNetwork: string;
  errorHttp: (status: number) => string;
  errorParse: string;
  staleBanner: string;
  staleBannerDetail: string;
  freshnessLabel: string;
  freshnessFresh: string;
  freshnessDelayed: string;
  freshnessStale: string;
  freshnessPartial: string;
  freshnessFailed: string;
  freshnessUnknown: string;
  freshnessRetrievedAt: string;
  metadataModelRun: string;
  metadataValidTime: string;
  metadataAccumulation: (hours: number) => string;
  metadataProvider: string;
  metadataAttribution: string;
  metadataLicense: string;
  legendTitle: string;
  legendUnit: string;
  legendIntensity: (rainMm: number) => string;
  showingLastFresh: string;
  noFrameSelected: string;
  selectFrame: string;
  cellTooltip: (rainMm: number) => string;
  refresh: string;
  /** Visible map attribution prefix (e.g. label before the source list). */
  mapAttributionLabel: string;
  /** Tile-provider attribution shown on the MapLibre canvas. */
  mapTileAttribution: string;
  /** License/permission note shown alongside tile attribution. */
  mapTileLicense: string;
  /** Accessible label for the MapLibre map container. */
  mapAriaLabel: string;
  /** Heading shown when the basin map crashes (error boundary fallback). */
  mapErrorTitle: string;
  /** Body copy explaining the map failure to public users. */
  mapErrorBody: string;
  /** Action label to reload the page after a map failure. */
  mapErrorReload: string;
  /** Label prefix before a station's last-observed timestamp. */
  stationObservedAt: string;
  /** Chip label when station data is older than the stale threshold. */
  stationStaleChip: string;
  /** Tooltip explaining why the station reading is flagged stale (age-aware). */
  stationStaleDetail: (maxAgeHours: number) => string;
  /** Forecast data freshness label shown in the risk card data-state row. */
  forecastFreshnessRow: (label: string) => string;
  /** Label for the data-source row in the risk card. */
  dataSource: string;
  /** Forecast API error shown in the risk card data-state row. */
  forecastErrorRow: string;
  /** Page-level banner heading shown when the live forecast cannot load. */
  primaryErrorBanner: string;
  /** Page-level banner body shown when the live forecast cannot load. */
  primaryErrorBannerDetail: string;
  /** Page-level banner heading shown when only stale forecast data is available. */
  primaryStaleBanner: string;
  /** Page-level banner body shown when only stale forecast data is available. */
  primaryStaleBannerDetail: string;
  /** Call to action on the alert opt-in button when not yet subscribed. */
  alertSubscribe: string;
  /** Button label while a subscribe/unsubscribe request is in flight. */
  alertWorking: string;
  /** Label shown when push alerts are active. */
  alertSubscribed: string;
  /** Small link to turn alerts off. */
  alertUnsubscribe: string;
  /** Short error shown if subscribing fails (kept non-alarming). */
  alertError: string;
  /** Accessible label describing what the alert button does. */
  alertAriaLabel: string;
  /** Ensemble chip: both providers fresh and agree on the same risk level. */
  ensembleBothAgree: string;
  /** Ensemble chip: both providers fresh but report different risk levels (UI shows the highest). */
  ensembleBothDiffer: string;
  /** Ensemble chip: only one provider had fresh data. */
  ensembleSingleProvider: string;
  // ---- Shelter overlay + nearest-shelter guidance (HFT-72) -------------
  /** Label for the persistent shelter map toggle. */
  shelterToggle: string;
  /** Accessible description for the shelter toggle control. */
  shelterToggleAria: string;
  /** Heading for the nearest-shelter guidance card (orange/red only). */
  nearestSheltersTitle: string;
  /** Short subtitle under the nearest-shelter heading. */
  nearestSheltersSubtitle: string;
  /** Distance line when measured from the user's device location. */
  distanceFromYou: (km: string) => string;
  /** Distance line when measured from the city centre fallback. */
  distanceFromCenter: (km: string) => string;
  /** Note shown when geolocation is unavailable and the city centre is used. */
  distanceCenterNote: string;
  /** Loading copy while the shelter directory is being fetched. */
  sheltersLoading: string;
  /** Copy shown when the shelter directory is empty. */
  sheltersEmpty: string;
  /** Error copy when the shelter directory fails to load. */
  sheltersError: string;
  /** Capacity line for a shelter (people). */
  shelterCapacity: (people: number) => string;
  /** Shown when a shelter's capacity is not published. */
  shelterCapacityUnknown: string;
  /** Localized facility-type labels. */
  shelterTypeLabels: {
    school: string;
    university: string;
    temple: string;
    community_center: string;
    other: string;
  };
  /** Prefix before the dataset retrieved date in the shelter info line. */
  shelterDatasetDate: (date: string) => string;
  /** Accessible accuracy note disclosure label. */
  shelterAccuracyNote: string;
}

const TH: ForecastFramesCopy = {
  layerLabel: "ฝนคาดการณ์ (จริง)",
  layerSubtitle: "ปริมาณฝนสะสมจากการพยากรณ์ตามกริดในลุ่มน้ำคลองอู่ตะเภา",
  noFrames: "ยังไม่มีกรอบเวลาพยากรณ์ที่พร้อมใช้งาน",
  loading: "กำลังโหลดข้อมูลฝนคาดการณ์",
  loadingDetail: "เชื่อมต่อบริการพยากรณ์...",
  errorTitle: "ไม่สามารถโหลดข้อมูลฝนคาดการณ์",
  errorRetry: "ลองใหม่อีกครั้ง",
  errorNetwork: "เครือข่ายขัดข้อง โปรดตรวจสอบการเชื่อมต่อแล้วลองใหม่",
  errorHttp: (status: number) => `บริการตอบกลับด้วยรหัสข้อผิดพลาด ${status}`,
  errorParse: "รูปแบบข้อมูลไม่ตรงกับที่กำหนด โปรดติดต่อผู้ดูแลระบบ",
  staleBanner: "ข้อมูลล่าสุดเก่าเกินเกณฑ์ความสด",
  staleBannerDetail:
    "แสดงผลเฟรมล่าสุดที่มี โปรดตรวจสอบประกาศจากแหล่งทางการก่อนตัดสินใจ",
  freshnessLabel: "สถานะข้อมูล",
  freshnessFresh: "สด",
  freshnessDelayed: "ล่าช้า",
  freshnessStale: "เก่าเกินเกณฑ์",
  freshnessPartial: "ไม่ครบ",
  freshnessFailed: "ดึงข้อมูลล้มเหลว",
  freshnessUnknown: "ไม่ทราบสถานะ",
  freshnessRetrievedAt: "ดึงข้อมูลเมื่อ",
  metadataModelRun: "เวลารันโมเดล",
  metadataValidTime: "เวลาที่พยากรณ์",
  metadataAccumulation: (hours: number) => `สะสม ${hours} ชม.`,
  metadataProvider: "ผู้ให้ข้อมูล",
  metadataAttribution: "เครดิต",
  metadataLicense: "สัญญาอนุญาต",
  legendTitle: "ระดับความเสี่ยงจากฝนสะสม",
  legendUnit: "มิลลิเมตร",
  legendIntensity: (rainMm: number) => `${rainMm.toFixed(1)} มม.`,
  showingLastFresh: "ยังคงแสดงข้อมูลล่าสุดที่ผ่านมา",
  noFrameSelected: "ยังไม่ได้เลือกกรอบเวลา",
  selectFrame: "เลือกกรอบเวลาพยากรณ์",
  cellTooltip: (rainMm: number) => `ฝนสะสม ${rainMm.toFixed(1)} มม.`,
  refresh: "รีเฟรช",
  mapAttributionLabel: "เครดิตแผนที่",
  mapTileAttribution:
    "© ผู้ร่วมสมทบ OpenStreetMap · ไทล์โดย MapLibre demotiles",
  mapTileLicense:
    "ไทล์อยู่ภายใต้สัญญาอนุญาต ODbL สำหรับการใช้งานสาธารณะแบบไม่แสวงหากำไร",
  mapAriaLabel: "แผนที่ลุ่มน้ำคลองอู่ตะเภาและทะเลสาบสงขลา",
  mapErrorTitle: "ไม่สามารถแสดงแผนที่ได้ในขณะนี้",
  mapErrorBody:
    "อุปกรณ์หรือเครือข่ายของคุณอาจไม่รองรับ คุณยังสามารถใช้ข้อมูลส่วนอื่น ๆ ในหน้านี้ได้",
  mapErrorReload: "โหลดหน้าใหม่",
  stationObservedAt: "วัดเมื่อ",
  stationStaleChip: "ข้อมูลเก่า",
  stationStaleDetail: (maxAgeHours: number) =>
    `ข้อมูลสถานีนี้อาจล้าสมัย (เกิน ${maxAgeHours} ชั่วโมง)`,
  forecastFreshnessRow: (label: string) => `สถานะพยากรณ์: ${label}`,
  dataSource: "แหล่งข้อมูล: GFS + ECMWF Open Data",
  forecastErrorRow: "พยากรณ์: ไม่สามารถโหลดได้",
  primaryErrorBanner: "ขณะนี้ไม่สามารถเชื่อมต่อข้อมูลพยากรณ์ล่าสุดได้",
  primaryErrorBannerDetail:
    "นี่ไม่ใช่การยืนยันว่าปลอดภัย โปรดติดตามประกาศจากหน่วยงานทางการและลองโหลดข้อมูลใหม่อีกครั้ง",
  primaryStaleBanner: "กำลังแสดงข้อมูลพยากรณ์ล่าสุดที่ดึงได้ ซึ่งอาจไม่เป็นปัจจุบัน",
  primaryStaleBannerDetail:
    "ระบบยังไม่สามารถอัปเดตข้อมูลล่าสุดได้ โปรดตรวจสอบประกาศจากหน่วยงานทางการก่อนตัดสินใจ",
  alertSubscribe: "รับการแจ้งเตือน",
  alertWorking: "กำลังดำเนินการ...",
  alertSubscribed: "เปิดการแจ้งเตือนแล้ว",
  alertUnsubscribe: "ปิดการแจ้งเตือน",
  alertError: "เปิดการแจ้งเตือนไม่สำเร็จ ลองใหม่อีกครั้ง",
  alertAriaLabel: "รับการแจ้งเตือนน้ำท่วมผ่านการแจ้งเตือนบนอุปกรณ์",
  ensembleBothAgree: "2 โมเดลสอดคล้อง",
  ensembleBothDiffer: "2 โมเดล (แสดงระดับสูงสุด)",
  ensembleSingleProvider: "1 โมเดลเท่านั้น",
  shelterToggle: "ศูนย์พักพิง",
  shelterToggleAria: "แสดงหรือซ่อนศูนย์พักพิงบนแผนที่",
  nearestSheltersTitle: "ศูนย์พักพิงใกล้คุณ",
  nearestSheltersSubtitle:
    "จุดอพยพที่ใกล้ที่สุด เรียงตามระยะทาง เพื่อความปลอดภัยในภาวะเสี่ยงสูง",
  distanceFromYou: (km: string) => `ห่างจากคุณประมาณ ${km} กม.`,
  distanceFromCenter: (km: string) => `ห่างจากใจกลางเมืองประมาณ ${km} กม.`,
  distanceCenterNote:
    "ไม่ได้รับตำแหน่งอุปกรณ์ จึงวัดระยะจากใจกลางเมืองหาดใหญ่",
  sheltersLoading: "กำลังโหลดข้อมูลศูนย์พักพิง...",
  sheltersEmpty: "ยังไม่มีข้อมูลศูนย์พักพิงในขณะนี้",
  sheltersError:
    "ไม่สามารถโหลดข้อมูลศูนย์พักพิงได้ โปรดติดตามประกาศจากหน่วยงานทางการ",
  shelterCapacity: (people: number) =>
    `รองรับได้ประมาณ ${people.toLocaleString("th-TH")} คน`,
  shelterCapacityUnknown: "ไม่ระบุความจุ",
  shelterTypeLabels: {
    school: "โรงเรียน",
    university: "มหาวิทยาลัย",
    temple: "วัด",
    community_center: "ศูนย์ชุมชน",
    other: "อื่น ๆ",
  },
  shelterDatasetDate: (date: string) => `ข้อมูลปรับปรุงเมื่อ ${date}`,
  shelterAccuracyNote: "หมายเหตุความแม่นยำของพิกัด",
};

const EN: ForecastFramesCopy = {
  layerLabel: "Forecast rainfall (live)",
  layerSubtitle: "Gridded rainfall accumulation across the U-Tapao basin.",
  noFrames: "No forecast frames available yet.",
  loading: "Loading forecast rainfall",
  loadingDetail: "Contacting forecast service...",
  errorTitle: "Could not load forecast rainfall",
  errorRetry: "Try again",
  errorNetwork: "Network error. Check your connection and retry.",
  errorHttp: (status: number) => `Service responded with status ${status}.`,
  errorParse: "Unexpected response shape. Please contact the maintainers.",
  staleBanner: "Latest data is older than the freshness threshold.",
  staleBannerDetail:
    "Showing the most recent frame. Check official sources before acting on it.",
  freshnessLabel: "Data status",
  freshnessFresh: "Fresh",
  freshnessDelayed: "Delayed",
  freshnessStale: "Stale",
  freshnessPartial: "Partial",
  freshnessFailed: "Failed",
  freshnessUnknown: "Unknown",
  freshnessRetrievedAt: "Retrieved at",
  metadataModelRun: "Model run",
  metadataValidTime: "Valid time",
  metadataAccumulation: (hours: number) => `${hours}h accumulation`,
  metadataProvider: "Provider",
  metadataAttribution: "Attribution",
  metadataLicense: "License",
  legendTitle: "Rainfall risk legend",
  legendUnit: "millimeters",
  legendIntensity: (rainMm: number) => `${rainMm.toFixed(1)} mm`,
  showingLastFresh: "Still showing the last successfully retrieved frame.",
  noFrameSelected: "No frame selected.",
  selectFrame: "Select forecast frame",
  cellTooltip: (rainMm: number) => `${rainMm.toFixed(1)} mm rainfall`,
  refresh: "Refresh",
  mapAttributionLabel: "Map attribution",
  mapTileAttribution:
    "© OpenStreetMap contributors · Tiles by MapLibre demotiles",
  mapTileLicense:
    "Tiles available under ODbL for non-commercial public-awareness use.",
  mapAriaLabel: "Map of the U-Tapao canal and Songkhla Lake basin",
  mapErrorTitle: "The map cannot be displayed right now",
  mapErrorBody:
    "Your device or network may not support the map. The rest of this page is still available.",
  mapErrorReload: "Reload page",
  stationObservedAt: "Observed at",
  stationStaleChip: "Stale",
  stationStaleDetail: (maxAgeHours: number) =>
    `This station reading may be out of date (over ${maxAgeHours} hours old).`,
  forecastFreshnessRow: (label: string) => `Forecast status: ${label}`,
  dataSource: "Sources: GFS + ECMWF Open Data",
  forecastErrorRow: "Forecast: could not load",
  primaryErrorBanner: "Live forecast data is unavailable right now",
  primaryErrorBannerDetail:
    "This is not an all-clear. Follow official notices and try reloading the forecast.",
  primaryStaleBanner: "Showing the last retrieved forecast, which may be out of date",
  primaryStaleBannerDetail:
    "The system could not refresh to the latest data. Check official sources before acting on it.",
  alertSubscribe: "Get flood alerts",
  alertWorking: "Working...",
  alertSubscribed: "Alerts on",
  alertUnsubscribe: "Turn off",
  alertError: "Could not enable alerts. Please try again.",
  alertAriaLabel: "Get flood alerts as device notifications",
  ensembleBothAgree: "2 models agree",
  ensembleBothDiffer: "2 models (highest shown)",
  ensembleSingleProvider: "1 model only",
  shelterToggle: "Shelters",
  shelterToggleAria: "Show or hide evacuation shelters on the map",
  nearestSheltersTitle: "Shelters near you",
  nearestSheltersSubtitle:
    "Closest evacuation points, sorted by distance, for use during high-risk conditions.",
  distanceFromYou: (km: string) => `About ${km} km from you`,
  distanceFromCenter: (km: string) => `About ${km} km from the city centre`,
  distanceCenterNote:
    "Device location unavailable — distances measured from central Hat Yai.",
  sheltersLoading: "Loading shelter directory...",
  sheltersEmpty: "No shelter information is available right now.",
  sheltersError:
    "Could not load the shelter directory. Follow official notices for evacuation points.",
  shelterCapacity: (people: number) =>
    `Holds roughly ${people.toLocaleString("en-GB")} people`,
  shelterCapacityUnknown: "Capacity not published",
  shelterTypeLabels: {
    school: "School",
    university: "University",
    temple: "Temple",
    community_center: "Community centre",
    other: "Other",
  },
  shelterDatasetDate: (date: string) => `Data updated ${date}`,
  shelterAccuracyNote: "Coordinate accuracy note",
};

export const FORECAST_FRAMES_COPY: Record<Language, ForecastFramesCopy> = {
  th: TH,
  en: EN,
};

/** Map a freshness status to localized human copy. */
export function freshnessLabel(
  status: ForecastFreshnessStatus | null | undefined,
  copy: ForecastFramesCopy,
): string {
  switch (status) {
    case "fresh":
      return copy.freshnessFresh;
    case "delayed":
      return copy.freshnessDelayed;
    case "stale":
      return copy.freshnessStale;
    case "partial":
      return copy.freshnessPartial;
    case "failed":
      return copy.freshnessFailed;
    default:
      return copy.freshnessUnknown;
  }
}

/** Format an absolute datetime in the user's chosen language. */
export function formatDateTime(date: Date, language: Language): string {
  const locale = language === "th" ? "th-TH" : "en-GB";
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Bangkok",
  }).format(date);
}
