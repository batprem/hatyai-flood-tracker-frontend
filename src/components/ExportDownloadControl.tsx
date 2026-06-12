/**
 * Research export download control for the history explorer (HFT-78).
 *
 * Lets researchers pick a dataset, file format, and inclusive UTC date range,
 * then downloads the file from `GET /api/export` through a plain anchor
 * navigation (the backend sets `Content-Disposition`, so no client-side
 * streaming is needed). The button is disabled until the date range is valid,
 * mirroring the backend's 92-day maximum and end >= start rules.
 */

import { useState } from "react";
import { Download } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  buildExportUrl,
  ExportDatasetValues,
  ExportFormatValues,
  MAX_EXPORT_RANGE_DAYS,
  validateExportRange,
  type ExportDataset,
  type ExportFormat,
} from "@/lib/api/export";
import { EXPORT_COPY } from "@/lib/i18n/export";
import type { Language } from "@/lib/i18n/forecastFrames";

const fieldClass =
  "h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500";

function isExportDataset(value: string): value is ExportDataset {
  return (ExportDatasetValues as readonly string[]).includes(value);
}

function isExportFormat(value: string): value is ExportFormat {
  return (ExportFormatValues as readonly string[]).includes(value);
}

/**
 * Date-range-aware download control for research exports.
 *
 * Props:
 *   language: Display language — "th" or "en".
 */
export function ExportDownloadControl({ language }: { language: Language }) {
  const t = EXPORT_COPY[language];
  const [dataset, setDataset] = useState<ExportDataset>("risk_history");
  const [format, setFormat] = useState<ExportFormat>("csv");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");

  const validation = validateExportRange(start, end);
  const downloadUrl =
    validation === "ok"
      ? buildExportUrl({ dataset, format, start, end })
      : null;

  const validationMessage =
    validation === "missing"
      ? t.missingRange
      : validation === "endBeforeStart"
        ? t.endBeforeStart
        : validation === "tooLong"
          ? t.tooLong(MAX_EXPORT_RANGE_DAYS)
          : null;

  return (
    <Card className="border border-slate-200 bg-white text-slate-950 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg font-black">
          <Download className="size-4 text-cyan-700" aria-hidden />
          {t.title}
        </CardTitle>
        <CardDescription className="text-xs text-slate-500">
          {t.description}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3 pt-0">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t.datasetLabel}
            </span>
            <select
              className={fieldClass}
              value={dataset}
              onChange={(event) => {
                const { value } = event.target;
                if (isExportDataset(value)) {
                  setDataset(value);
                }
              }}
            >
              {ExportDatasetValues.map((value) => (
                <option key={value} value={value}>
                  {t.datasetNames[value]}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t.formatLabel}
            </span>
            <select
              className={fieldClass}
              value={format}
              onChange={(event) => {
                const { value } = event.target;
                if (isExportFormat(value)) {
                  setFormat(value);
                }
              }}
            >
              {ExportFormatValues.map((value) => (
                <option key={value} value={value}>
                  {t.formatNames[value]}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t.startLabel}
            </span>
            <input
              type="date"
              className={fieldClass}
              value={start}
              onChange={(event) => setStart(event.target.value)}
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t.endLabel}
            </span>
            <input
              type="date"
              className={fieldClass}
              value={end}
              onChange={(event) => setEnd(event.target.value)}
            />
          </label>
        </div>

        {downloadUrl !== null ? (
          <a
            href={downloadUrl}
            className="inline-flex h-9 items-center gap-2 rounded-md bg-cyan-700 px-4 text-sm font-bold text-white hover:bg-cyan-800"
          >
            <Download className="size-4" aria-hidden />
            {t.downloadButton}
          </a>
        ) : (
          <div className="space-y-1.5">
            <button
              type="button"
              disabled
              className="inline-flex h-9 cursor-not-allowed items-center gap-2 rounded-md bg-slate-200 px-4 text-sm font-bold text-slate-400"
            >
              <Download className="size-4" aria-hidden />
              {t.downloadButton}
            </button>
            {validationMessage !== null && (
              <p className="text-xs text-slate-500" role="status">
                {validationMessage}
              </p>
            )}
          </div>
        )}

        <p className="text-xs text-slate-400">{t.unitsNote}</p>
      </CardContent>
    </Card>
  );
}
