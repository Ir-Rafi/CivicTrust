import { num, type Lang } from "@/lib/i18n";

const locale = (lang: Lang) => (lang === "bn" ? "bn-BD" : "en-GB");

export function taka(amount: number | null | undefined, lang: Lang): string {
  if (amount === null || amount === undefined) return "—";
  return `৳ ${num(amount, lang)}`;
}

export function dateTime(iso: string, lang: Lang): string {
  return new Date(iso).toLocaleString(locale(lang), { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Dhaka" });
}

export function dateOnly(iso: string, lang: Lang): string {
  return new Date(iso).toLocaleDateString(locale(lang), { dateStyle: "medium", timeZone: "Asia/Dhaka" });
}

/** Severity bands match deadlineHoursFor() in severity.ts: 8+ critical, 5–7 high, below that routine. */
export function severityTone(score: number): "critical" | "moderate" | "low" {
  if (score >= 8) return "critical";
  if (score >= 5) return "moderate";
  return "low";
}

/** Dot colour for an issue or work-order status tag. */
export function statusTone(status: string): "verified" | "critical" | "primary" | "moderate" | "warning" {
  if (["fixed", "confirmed", "approved", "released"].includes(status)) return "verified";
  if (["disputed", "rejected"].includes(status)) return "critical";
  if (["submitted", "needs_review", "eligible"].includes(status)) return "warning";
  if (["assigned", "in_progress", "open"].includes(status)) return "primary";
  return "moderate";
}
