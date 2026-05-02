import { Clock3, Database, Gauge, Info, Radio } from "lucide-react";

import type { ForecastFrame, ForecastFreshness } from "@/lib/api/forecastFrames";
import {
  type ForecastFramesCopy,
  type Language,
  formatDateTime,
} from "@/lib/i18n/forecastFrames";

interface ForecastFrameMetadataProps {
  frame: ForecastFrame | null;
  freshness: ForecastFreshness | null;
  copy: ForecastFramesCopy;
  language: Language;
}

export function ForecastFrameMetadata({
  frame,
  freshness,
  copy,
  language,
}: ForecastFrameMetadataProps) {
  if (!frame) {
    return (
      <p className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-3 text-xs text-slate-600">
        {copy.noFrameSelected}
      </p>
    );
  }

  const items = [
    {
      icon: <Clock3 className="size-3.5" aria-hidden />,
      label: copy.metadataModelRun,
      value: formatDateTime(frame.runTime, language),
    },
    {
      icon: <Gauge className="size-3.5" aria-hidden />,
      label: copy.metadataValidTime,
      value: `${formatDateTime(frame.validTime, language)} (${copy.metadataAccumulation(frame.accumulationHours)})`,
    },
    {
      icon: <Radio className="size-3.5" aria-hidden />,
      label: copy.metadataProvider,
      value: `${frame.provider.toUpperCase()} · ${frame.model}`,
    },
    {
      icon: <Info className="size-3.5" aria-hidden />,
      label: copy.metadataAttribution,
      value: frame.source.attribution,
    },
    {
      icon: <Database className="size-3.5" aria-hidden />,
      label: copy.metadataLicense,
      value: frame.source.license,
    },
  ] as const;

  return (
    <dl className="grid gap-2 text-xs text-slate-700">
      {items.map((item) => (
        <div
          key={item.label}
          className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white/80 px-3 py-2"
        >
          <dt className="flex min-w-0 items-center gap-1 font-bold uppercase tracking-wide text-slate-500">
            {item.icon}
            <span className="truncate">{item.label}</span>
          </dt>
          <dd className="max-w-[60%] text-right text-slate-800">{item.value}</dd>
        </div>
      ))}
      {freshness?.retrievedAt ? (
        <div className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white/80 px-3 py-2">
          <dt className="flex items-center gap-1 font-bold uppercase tracking-wide text-slate-500">
            <Clock3 className="size-3.5" aria-hidden />
            <span>{copy.freshnessRetrievedAt}</span>
          </dt>
          <dd className="text-right text-slate-800">
            {formatDateTime(freshness.retrievedAt, language)}
          </dd>
        </div>
      ) : null}
    </dl>
  );
}
