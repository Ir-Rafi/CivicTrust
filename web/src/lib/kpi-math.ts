// Small, pure helpers for the measurements on /impact and in `pnpm kpi`.

/** Below this many records a figure is shown as early data, not as a measured result. */
export const KPI_MIN_SAMPLE = 10;

export type SampleStatus = "none" | "early" | "measured";

export function sampleStatus(n: number): SampleStatus {
  if (n <= 0) return "none";
  return n < KPI_MIN_SAMPLE ? "early" : "measured";
}

/** Percentage with one decimal, or null when there is nothing to divide by. */
export function pct(part: number, whole: number): number | null {
  return whole === 0 ? null : Math.round((part / whole) * 1000) / 10;
}

export function median(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Nearest-rank percentile (p in 0–100). */
export function percentile(xs: number[], p: number): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.ceil((p / 100) * s.length) - 1))];
}

/** A `YYYY-MM-DD` date that exists, or null. Used for the measurement window. */
export function parseSince(value: string | undefined | null): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value ? null : value;
}
