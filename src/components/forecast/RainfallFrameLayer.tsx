import { CloudRain } from "lucide-react";
import type { CSSProperties } from "react";

import type { ForecastFrame } from "@/lib/api/forecastFrames";
import {
  RISK_LEVEL_STYLES,
  classifyRainfallMm,
  type RiskLevel,
} from "@/lib/risk/rainfallThresholds";
import type { ForecastFramesCopy } from "@/lib/i18n/forecastFrames";
import { cn } from "@/lib/utils";

interface RainfallFrameLayerProps {
  frame: ForecastFrame;
  copy: ForecastFramesCopy;
  /** Optional dimming when displayed in stale state. */
  isStale?: boolean;
}

interface CellRenderInfo {
  index: number;
  rainMm: number;
  level: RiskLevel;
  style: CSSProperties;
}

/**
 * Render a forecast frame's `valuesMm` grid as positioned cells over the map.
 *
 * `valuesMm` is a row-major array of length `width * height`. We assume the
 * grid uses `EPSG:4326` (matches the contract) and place each cell relative to
 * the frame's bbox so the layout adapts to differently sized grids without
 * hard-coded coordinates. The rendered cells live inside an absolutely
 * positioned container — the parent owns map shape.
 */
export function RainfallFrameLayer({ frame, copy, isStale = false }: RainfallFrameLayerProps) {
  const cells = buildCells(frame);

  return (
    <div
      className={cn(
        "absolute inset-0 transition-opacity",
        isStale ? "opacity-70" : "opacity-100",
      )}
      role="group"
      aria-label={copy.layerLabel}
    >
      {cells.map((cell) => {
        const visual = RISK_LEVEL_STYLES[cell.level];
        return (
          <div
            key={`${frame.frameId}:${cell.index}`}
            className={cn(
              "absolute flex items-center justify-center rounded-2xl border border-white/60 text-[10px] font-black text-white shadow-md backdrop-blur-sm",
              visual.fill,
            )}
            style={cell.style}
            title={copy.cellTooltip(cell.rainMm)}
            aria-label={copy.cellTooltip(cell.rainMm)}
          >
            <span className="flex flex-col items-center gap-0.5 px-1">
              <CloudRain className="size-3.5" aria-hidden />
              <span className="leading-none">{cell.rainMm.toFixed(1)}</span>
              <span className="text-[8px] font-semibold uppercase opacity-90">mm</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

function buildCells(frame: ForecastFrame): CellRenderInfo[] {
  const { grid, valuesMm, accumulationHours } = frame;
  const expected = grid.width * grid.height;
  const safeValues = valuesMm.length === expected ? valuesMm : valuesMm.slice(0, expected);

  const cellWidthPercent = 100 / grid.width;
  const cellHeightPercent = 100 / grid.height;
  const cells: CellRenderInfo[] = [];

  for (let row = 0; row < grid.height; row += 1) {
    for (let col = 0; col < grid.width; col += 1) {
      const index = row * grid.width + col;
      const rainMm = safeValues[index] ?? 0;
      const level = classifyRainfallMm(rainMm, accumulationHours);
      // Place each cell with a 6% inset so neighbours don't visually merge.
      const left = col * cellWidthPercent + cellWidthPercent * 0.08;
      const top = row * cellHeightPercent + cellHeightPercent * 0.08;
      const width = cellWidthPercent * 0.84;
      const height = cellHeightPercent * 0.84;
      cells.push({
        index,
        rainMm,
        level,
        style: {
          left: `${left}%`,
          top: `${top}%`,
          width: `${width}%`,
          height: `${height}%`,
        },
      });
    }
  }

  return cells;
}
