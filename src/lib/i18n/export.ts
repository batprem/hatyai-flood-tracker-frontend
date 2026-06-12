/**
 * Translation-ready copy for the research export download control (HFT-78).
 *
 * Keep all export-specific strings here so we can swap to a richer i18n
 * library without grep-replacing across components.
 */

import type {
  ExportDataset,
  ExportFormat,
} from "@/lib/api/export";
import type { Language } from "@/lib/i18n/forecastFrames";

export interface ExportCopy {
  title: string;
  description: string;
  datasetLabel: string;
  datasetNames: Record<ExportDataset, string>;
  formatLabel: string;
  formatNames: Record<ExportFormat, string>;
  startLabel: string;
  endLabel: string;
  downloadButton: string;
  missingRange: string;
  endBeforeStart: string;
  tooLong: (maxDays: number) => string;
  unitsNote: string;
}

export const EXPORT_COPY: Record<Language, ExportCopy> = {
  th: {
    title: "ดาวน์โหลดข้อมูล",
    description:
      "ดาวน์โหลดข้อมูลย้อนหลังสำหรับงานวิจัยเป็นไฟล์ CSV หรือ GeoJSON ตามช่วงวันที่ที่เลือก",
    datasetLabel: "ชุดข้อมูล",
    datasetNames: {
      forecast_frames: "ฝนพยากรณ์ (เฟรมพยากรณ์)",
      risk_history: "เหตุการณ์น้ำท่วมย้อนหลัง",
      station_observations: "ค่าตรวจวัดสถานีน้ำ",
    },
    formatLabel: "รูปแบบไฟล์",
    formatNames: {
      csv: "CSV",
      geojson: "GeoJSON",
    },
    startLabel: "วันที่เริ่มต้น",
    endLabel: "วันที่สิ้นสุด",
    downloadButton: "ดาวน์โหลดข้อมูล",
    missingRange: "เลือกช่วงวันที่ก่อนดาวน์โหลด",
    endBeforeStart: "วันที่สิ้นสุดต้องไม่อยู่ก่อนวันที่เริ่มต้น",
    tooLong: (maxDays) => `ช่วงวันที่ต้องไม่เกิน ${maxDays} วัน`,
    unitsNote:
      "เวลาทั้งหมดเป็น UTC (ISO 8601) ปริมาณฝนหน่วย มม. ระดับน้ำหน่วยเมตร — หน่วยและคำอธิบายคอลัมน์อยู่ในส่วนหัวของไฟล์",
  },
  en: {
    title: "Download data",
    description:
      "Download historical data for research as CSV or GeoJSON for a chosen date range.",
    datasetLabel: "Dataset",
    datasetNames: {
      forecast_frames: "Forecast rainfall (forecast frames)",
      risk_history: "Historical flood events",
      station_observations: "Station observations",
    },
    formatLabel: "File format",
    formatNames: {
      csv: "CSV",
      geojson: "GeoJSON",
    },
    startLabel: "Start date",
    endLabel: "End date",
    downloadButton: "Download data",
    missingRange: "Choose a date range before downloading",
    endBeforeStart: "End date must not be before the start date",
    tooLong: (maxDays) => `Date range must not exceed ${maxDays} days`,
    unitsNote:
      "All timestamps are UTC (ISO 8601); rainfall in mm, water levels in metres — units and column notes are documented in the file header.",
  },
};
