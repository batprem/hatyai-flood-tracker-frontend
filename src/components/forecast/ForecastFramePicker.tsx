import type { ForecastFrame } from "@/lib/api/forecastFrames";
import {
  type ForecastFramesCopy,
  type Language,
  formatDateTime,
} from "@/lib/i18n/forecastFrames";
import { cn } from "@/lib/utils";

interface ForecastFramePickerProps {
  frames: ReadonlyArray<ForecastFrame>;
  selectedFrameId: string | null;
  onSelect: (frameId: string) => void;
  copy: ForecastFramesCopy;
  language: Language;
}

export function ForecastFramePicker({
  frames,
  selectedFrameId,
  onSelect,
  copy,
  language,
}: ForecastFramePickerProps) {
  if (frames.length === 0) {
    return null;
  }

  return (
    <fieldset className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white/70 p-3">
      <legend className="px-1 text-xs font-bold uppercase tracking-wide text-slate-500">
        {copy.selectFrame}
      </legend>
      <div className="flex flex-wrap gap-2">
        {frames.map((frame) => {
          const isActive = frame.frameId === selectedFrameId;
          return (
            <button
              key={frame.frameId}
              type="button"
              onClick={() => onSelect(frame.frameId)}
              aria-pressed={isActive}
              className={cn(
                "flex min-w-[8rem] flex-col items-start gap-0.5 rounded-xl border px-3 py-2 text-left text-xs transition",
                isActive
                  ? "border-cyan-500 bg-cyan-50 text-slate-900 shadow"
                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50",
              )}
            >
              <span className="font-bold">{`+${frame.forecastHour}h`}</span>
              <span className="text-[11px] text-slate-500">
                {formatDateTime(frame.validTime, language)}
              </span>
              <span className="text-[10px] uppercase tracking-wide text-slate-400">
                {copy.metadataAccumulation(frame.accumulationHours)}
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
