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
