/**
 * Rainfall accumulation thresholds for the public 4-level risk classification.
 *
 * Mirrors the backend defaults defined in `backend/app/core/config.py` for the
 * HFT-6 rule-based risk model. Treat this file as read-only configuration: it
 * exists in the frontend so map cells can be colored without a round-trip,
 * but the source of truth is the backend. Update both together if thresholds
 * change.
 */

/** The four public risk levels used everywhere in the UI. */
export const RiskLevels = ["green", "yellow", "orange", "red"] as const;
export type RiskLevel = (typeof RiskLevels)[number];

/** Severity ordering: a higher score means a more severe risk. */
export const RISK_LEVEL_SCORE: Record<RiskLevel, number> = {
  green: 0,
  yellow: 1,
  orange: 2,
  red: 3,
};

interface RainfallThreshold {
  yellowMm: number;
  orangeMm: number;
  redMm: number;
}

const DEFAULT_THRESHOLDS: Record<number, RainfallThreshold> = {
  1: { yellowMm: 25, orangeMm: 40, redMm: 60 },
  3: { yellowMm: 40, orangeMm: 70, redMm: 100 },
  6: { yellowMm: 60, orangeMm: 100, redMm: 150 },
  24: { yellowMm: 80, orangeMm: 130, redMm: 200 },
  48: { yellowMm: 120, orangeMm: 200, redMm: 300 },
  72: { yellowMm: 160, orangeMm: 250, redMm: 350 },
};

/** Return the configured thresholds for an accumulation window, if any. */
export function getRainfallThreshold(
  accumulationHours: number,
): RainfallThreshold | null {
  return DEFAULT_THRESHOLDS[accumulationHours] ?? null;
}

/**
 * Classify a rainfall accumulation against the configured Phase 1 thresholds.
 *
 * Falls back to the closest available window with a configured threshold,
 * scaling proportionally, so frames produced for non-standard accumulation
 * windows still render without invented colors.
 */
export function classifyRainfallMm(
  rainfallMm: number,
  accumulationHours: number,
): RiskLevel {
  const exact = getRainfallThreshold(accumulationHours);
  if (exact) {
    return classify(rainfallMm, exact);
  }

  const sortedWindows = Object.keys(DEFAULT_THRESHOLDS)
    .map((key) => Number(key))
    .sort((a, b) => a - b);
  const closest = sortedWindows.reduce(
    (best, hours) =>
      Math.abs(hours - accumulationHours) < Math.abs(best - accumulationHours)
        ? hours
        : best,
    sortedWindows[0] ?? 6,
  );
  const fallback = DEFAULT_THRESHOLDS[closest];
  if (!fallback) {
    return "green";
  }
  const scale = accumulationHours / closest;
  return classify(rainfallMm, {
    yellowMm: fallback.yellowMm * scale,
    orangeMm: fallback.orangeMm * scale,
    redMm: fallback.redMm * scale,
  });
}

function classify(rainfallMm: number, threshold: RainfallThreshold): RiskLevel {
  if (rainfallMm >= threshold.redMm) return "red";
  if (rainfallMm >= threshold.orangeMm) return "orange";
  if (rainfallMm >= threshold.yellowMm) return "yellow";
  return "green";
}

/** Tailwind classes paired with each level for consistent map + chart colors. */
export const RISK_LEVEL_STYLES: Record<
  RiskLevel,
  { fill: string; ring: string; text: string; dot: string }
> = {
  green: {
    fill: "bg-emerald-400/70",
    ring: "ring-emerald-300",
    text: "text-emerald-700",
    dot: "bg-emerald-500",
  },
  yellow: {
    fill: "bg-amber-300/75",
    ring: "ring-amber-300",
    text: "text-amber-700",
    dot: "bg-amber-400",
  },
  orange: {
    fill: "bg-orange-500/80",
    ring: "ring-orange-300",
    text: "text-orange-700",
    dot: "bg-orange-500",
  },
  red: {
    fill: "bg-red-500/85",
    ring: "ring-red-300",
    text: "text-red-700",
    dot: "bg-red-500",
  },
};
