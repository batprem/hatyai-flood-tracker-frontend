/**
 * Historical flood event list for the /history route (HFT-55, HFT-56).
 *
 * Fetches `GET /api/events/historical` and renders each event as an
 * expandable card. On expand the detail panel (HFT-56) is shown inline.
 */

import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Info } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  fetchHistoricalEvents,
  HistoricalEventsApiError,
  type HistoricalEvent,
  type HistoricalEventsResponse,
  type HistoricalEventRiskLevel,
} from "@/lib/api/historicalEvents";

// ---------------------------------------------------------------------------
// Language type (mirrors App.tsx)
// ---------------------------------------------------------------------------

type Language = "th" | "en";

// ---------------------------------------------------------------------------
// Risk color helpers (mirrors riskMeta in App.tsx)
// ---------------------------------------------------------------------------

const riskBadgeClass: Record<HistoricalEventRiskLevel, string> = {
  green: "border-emerald-300 bg-emerald-50 text-emerald-800",
  yellow: "border-amber-300 bg-amber-50 text-amber-800",
  orange: "border-orange-300 bg-orange-50 text-orange-800",
  red: "border-red-300 bg-red-50 text-red-800",
};

const riskDotClass: Record<HistoricalEventRiskLevel, string> = {
  green: "bg-emerald-500",
  yellow: "bg-amber-400",
  orange: "bg-orange-500",
  red: "bg-red-500",
};

const riskLabel: Record<HistoricalEventRiskLevel, Record<Language, string>> = {
  green: { th: "เขียว", en: "Green" },
  yellow: { th: "เหลือง", en: "Yellow" },
  orange: { th: "ส้ม", en: "Orange" },
  red: { th: "แดง", en: "Red" },
};

// ---------------------------------------------------------------------------
// Copy
// ---------------------------------------------------------------------------

const copy = {
  th: {
    pageTitle: "เหตุการณ์น้ำท่วมย้อนหลัง",
    pageSubtitle:
      "บันทึกเหตุการณ์น้ำท่วมสำคัญในอดีต พร้อมข้อมูลปริมาณฝนสะสม ระดับความเสี่ยง และแหล่งอ้างอิง",
    loading: "กำลังโหลดข้อมูล...",
    errorPrefix: "ไม่สามารถโหลดข้อมูลได้",
    flooded: "เกิดน้ำท่วม",
    rainfall24h: "ฝน 24 ชม.",
    rainfall48h: "ฝน 48 ชม.",
    rainfall72h: "ฝน 72 ชม.",
    ruleOutput: "ระดับความเสี่ยง",
    expandDetail: "ดูรายละเอียด",
    collapseDetail: "ย่อรายละเอียด",
    perWindowRisk: "ความเสี่ยงรายช่วงเวลา",
    window24h: "24 ชม.",
    window48h: "48 ชม.",
    window72h: "72 ชม.",
    narrative: "บันทึกเหตุการณ์",
    source: "แหล่งข้อมูล",
    thresholdBanner: "เหตุการณ์นี้มีผลต่อการปรับเกณฑ์ฝน",
    dataNote: "หมายเหตุข้อมูล",
    backToDashboard: "กลับหน้าหลัก",
    noEvents: "ไม่พบข้อมูลเหตุการณ์",
  },
  en: {
    pageTitle: "Historical Flood Events",
    pageSubtitle:
      "Records of significant past flood events with accumulated rainfall, risk levels, and source citations.",
    loading: "Loading events…",
    errorPrefix: "Could not load events",
    flooded: "Flooded",
    rainfall24h: "24h rain",
    rainfall48h: "48h rain",
    rainfall72h: "72h rain",
    ruleOutput: "Risk level",
    expandDetail: "Show details",
    collapseDetail: "Hide details",
    perWindowRisk: "Per-window risk",
    window24h: "24h",
    window48h: "48h",
    window72h: "72h",
    narrative: "Event narrative",
    source: "Source",
    thresholdBanner: "This event influenced threshold calibration",
    dataNote: "Data note",
    backToDashboard: "Back to dashboard",
    noEvents: "No events found",
  },
} as const;

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Renders a risk chip matching the existing App.tsx badge pattern. */
function RiskChip({
  level,
  language,
}: {
  level: HistoricalEventRiskLevel;
  language: Language;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-bold",
        riskBadgeClass[level],
      )}
    >
      <span
        className={cn("size-2 rounded-full", riskDotClass[level])}
        aria-hidden
      />
      {riskLabel[level][language]}
    </span>
  );
}

/** A small mm badge for rainfall windows. */
function RainfallBadge({
  label,
  valueMm,
}: {
  label: string;
  valueMm: number;
}) {
  return (
    <span className="inline-flex flex-col items-center rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-center">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </span>
      <span className="text-sm font-black text-slate-900">{valueMm} mm</span>
    </span>
  );
}

/** Per-window risk table shown in the detail panel. */
function PerWindowRiskTable({
  perWindowRisk,
  language,
  t,
}: {
  perWindowRisk: HistoricalEvent["per_window_risk"];
  language: Language;
  t: (typeof copy)[Language];
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        {t.perWindowRisk}
      </p>
      <div className="grid grid-cols-3 gap-2">
        {(
          [
            { key: "window_24h", label: t.window24h },
            { key: "window_48h", label: t.window48h },
            { key: "window_72h", label: t.window72h },
          ] as const
        ).map(({ key, label }) => (
          <div
            key={key}
            className="flex flex-col items-center gap-1 rounded-xl border border-slate-100 bg-slate-50 p-2"
          >
            <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              {label}
            </span>
            <RiskChip level={perWindowRisk[key]} language={language} />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Expandable detail panel (HFT-56). */
function EventDetailPanel({
  event,
  language,
  t,
}: {
  event: HistoricalEvent;
  language: Language;
  t: (typeof copy)[Language];
}) {
  const narrative =
    language === "th" ? event.narrative_th : event.narrative_en;
  const adjustmentNote =
    language === "th"
      ? event.threshold_adjustment_note_th
      : event.threshold_adjustment_note_en;

  return (
    <div className="mt-4 space-y-4 border-t border-slate-100 pt-4">
      <PerWindowRiskTable
        perWindowRisk={event.per_window_risk}
        language={language}
        t={t}
      />

      <div>
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
          {t.narrative}
        </p>
        <p className="text-sm leading-relaxed text-slate-700">{narrative}</p>
      </div>

      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
          {t.source}
        </p>
        <p className="text-xs text-slate-500">{event.source_citation}</p>
      </div>

      {event.threshold_adjustments_made && (
        <div className="flex gap-2 rounded-xl border border-cyan-200 bg-cyan-50 p-3">
          <Info
            className="mt-0.5 size-4 shrink-0 text-cyan-700"
            aria-hidden
          />
          <div className="space-y-1">
            <p className="text-sm font-semibold text-cyan-900">
              {t.thresholdBanner}
            </p>
            {adjustmentNote && (
              <p className="text-xs text-cyan-800">{adjustmentNote}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** Single expandable event card. */
function HistoricalEventCard({
  event,
  language,
  t,
}: {
  event: HistoricalEvent;
  language: Language;
  t: (typeof copy)[Language];
}) {
  const [expanded, setExpanded] = useState(false);

  const name = language === "th" ? event.event_name_th : event.event_name_en;
  const nameSub =
    language === "th" ? event.event_name_en : event.event_name_th;

  return (
    <Card className="border border-slate-200 bg-white text-slate-950 shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-0.5">
            {/* Date chip */}
            <span className="inline-block rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
              {event.event_date}
            </span>
            {/* Bilingual name */}
            <CardTitle className="mt-1.5 text-lg font-black leading-tight">
              {name}
            </CardTitle>
            <CardDescription className="text-xs text-slate-400">
              {nameSub}
            </CardDescription>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Risk chip */}
            <RiskChip level={event.rule_output} language={language} />

            {/* Flooded badge */}
            {event.flooded && (
              <span className="inline-flex items-center gap-1 rounded-full border border-blue-300 bg-blue-50 px-2 py-0.5 text-xs font-bold text-blue-800">
                <span className="size-2 rounded-full bg-blue-500" aria-hidden />
                {t.flooded}
              </span>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {/* Rainfall badges */}
        <div className="flex flex-wrap gap-2">
          <RainfallBadge
            label={t.rainfall24h}
            valueMm={event.accumulated_24h_mm}
          />
          <RainfallBadge
            label={t.rainfall48h}
            valueMm={event.accumulated_48h_mm}
          />
          <RainfallBadge
            label={t.rainfall72h}
            valueMm={event.accumulated_72h_mm}
          />
        </div>

        {/* Expand / collapse toggle */}
        <button
          type="button"
          className="mt-4 flex items-center gap-1 text-xs font-semibold text-cyan-700 hover:text-cyan-900"
          onClick={() => setExpanded((prev) => !prev)}
          aria-expanded={expanded}
        >
          {expanded ? (
            <>
              <ChevronUp className="size-3.5" />
              {t.collapseDetail}
            </>
          ) : (
            <>
              <ChevronDown className="size-3.5" />
              {t.expandDetail}
            </>
          )}
        </button>

        {expanded && (
          <EventDetailPanel event={event} language={language} t={t} />
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// HistoricalEventList (exported)
// ---------------------------------------------------------------------------

/**
 * Fetches and renders the list of historical flood events.
 *
 * Props:
 *   language: Display language — "th" or "en".
 *   onNavigateDashboard: Callback invoked when the user clicks "Back to dashboard".
 */
export function HistoricalEventList({
  language,
  onNavigateDashboard,
}: {
  language: Language;
  onNavigateDashboard: () => void;
}) {
  const t = copy[language];
  const [data, setData] = useState<HistoricalEventsResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setLoading(true);
    setErrorMessage(null);

    const controller = new AbortController();
    abortRef.current = controller;

    fetchHistoricalEvents(controller.signal)
      .then((response) => {
        setData(response);
      })
      .catch((err: unknown) => {
        if (
          err instanceof HistoricalEventsApiError &&
          err.detail.kind === "aborted"
        ) {
          return;
        }
        const message =
          err instanceof HistoricalEventsApiError
            ? err.detail.message
            : err instanceof Error
              ? err.message
              : "Unknown error";
        setErrorMessage(message);
      })
      .finally(() => {
        setLoading(false);
      });

    return () => {
      controller.abort();
    };
  }, []);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <button
          type="button"
          className="mb-4 text-sm font-semibold text-cyan-200 hover:text-white"
          onClick={onNavigateDashboard}
        >
          ← {t.backToDashboard}
        </button>
        <h2 className="text-3xl font-black text-white">{t.pageTitle}</h2>
        <p className="mt-2 max-w-2xl text-sm text-slate-300">{t.pageSubtitle}</p>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center text-slate-300">
          {t.loading}
        </div>
      )}

      {/* Error state */}
      {!loading && errorMessage !== null && (
        <div className="rounded-2xl border border-red-300 bg-red-50 p-4 text-sm text-red-800">
          <span className="font-semibold">{t.errorPrefix}: </span>
          {errorMessage}
        </div>
      )}

      {/* Empty state */}
      {!loading && errorMessage === null && data !== null && data.events.length === 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center text-slate-300">
          {t.noEvents}
        </div>
      )}

      {/* Event list */}
      {!loading && errorMessage === null && data !== null && data.events.length > 0 && (
        <div className="space-y-4">
          {data.events.map((event) => (
            <HistoricalEventCard
              key={event.event_id}
              event={event}
              language={language}
              t={t}
            />
          ))}

          {/* Data note */}
          <p className="text-center text-xs text-slate-400">
            {t.dataNote}: {data.data_note}
          </p>
        </div>
      )}
    </div>
  );
}
