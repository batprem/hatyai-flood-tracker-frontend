import { AlertOctagon, AlertTriangle, CheckCircle2, Clock3, HelpCircle, RefreshCw } from "lucide-react";
import type { ReactNode } from "react";

import type { ForecastFreshnessStatus } from "@/lib/api/forecastFrames";
import { type Language, type ForecastFramesCopy, freshnessLabel } from "@/lib/i18n/forecastFrames";
import { cn } from "@/lib/utils";

interface FreshnessChipProps {
  status: ForecastFreshnessStatus | null | undefined;
  language: Language;
  copy: ForecastFramesCopy;
  className?: string;
}

const STATUS_STYLES: Record<
  ForecastFreshnessStatus | "unknown",
  { className: string; Icon: () => ReactNode }
> = {
  fresh: {
    className: "border-emerald-300 bg-emerald-50 text-emerald-800",
    Icon: () => <CheckCircle2 className="size-3.5" aria-hidden />,
  },
  delayed: {
    className: "border-amber-300 bg-amber-50 text-amber-800",
    Icon: () => <Clock3 className="size-3.5" aria-hidden />,
  },
  stale: {
    className: "border-orange-300 bg-orange-50 text-orange-800",
    Icon: () => <AlertTriangle className="size-3.5" aria-hidden />,
  },
  partial: {
    className: "border-sky-300 bg-sky-50 text-sky-800",
    Icon: () => <RefreshCw className="size-3.5" aria-hidden />,
  },
  failed: {
    className: "border-red-300 bg-red-50 text-red-800",
    Icon: () => <AlertOctagon className="size-3.5" aria-hidden />,
  },
  unknown: {
    className: "border-slate-300 bg-slate-100 text-slate-700",
    Icon: () => <HelpCircle className="size-3.5" aria-hidden />,
  },
};

export function FreshnessChip({ status, language: _language, copy, className }: FreshnessChipProps) {
  const key: ForecastFreshnessStatus | "unknown" = status ?? "unknown";
  const visual = STATUS_STYLES[key];
  return (
    <span
      role="status"
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-bold",
        visual.className,
        className,
      )}
    >
      <visual.Icon />
      <span className="uppercase tracking-wide">{copy.freshnessLabel}:</span>
      <span>{freshnessLabel(status, copy)}</span>
    </span>
  );
}
