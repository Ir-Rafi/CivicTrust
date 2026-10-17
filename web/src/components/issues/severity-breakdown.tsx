import { num, type Dict, type Lang } from "@/lib/i18n";
import type { SeverityResult } from "@/lib/severity";

export function severityTone(score: number): string {
  if (score >= 8) return "bg-danger text-white";
  if (score >= 5) return "bg-warning text-white";
  return "bg-accent text-accent-fg";
}

export function SeverityBadge({ score, lang, size = "md" }: { score: number; lang: Lang; size?: "md" | "lg" }) {
  const dims = size === "lg" ? "h-16 w-16 text-3xl" : "h-9 w-9 text-base";
  return (
    <span className={`inline-flex shrink-0 items-center justify-center rounded-full font-bold ${dims} ${severityTone(score)}`}>
      {num(score, lang)}
    </span>
  );
}

/** Every factor behind the score, so citizens and officers can check it. */
export function SeverityBreakdown({ severity, lang, t }: { severity: SeverityResult; lang: Lang; t: Dict["issue"] }) {
  return (
    <div>
      <h2 className="mb-2 text-sm font-semibold">{t.why}</h2>
      <ul className="divide-y divide-line rounded-md border border-line">
        {severity.components.map((c) => (
          <li key={c.key} className="flex items-start justify-between gap-3 px-3 py-2 text-sm">
            <div>
              <p className="font-medium">{lang === "bn" ? c.labelBn : c.label}</p>
              <p className="text-muted">{lang === "bn" ? c.detailBn : c.detail}</p>
            </div>
            <span className={`shrink-0 font-mono text-sm ${c.points > 0 ? "font-semibold" : "text-muted"}`}>
              +{num(c.points, lang, 2)}
            </span>
          </li>
        ))}
        <li className="flex justify-between px-3 py-2 text-sm font-semibold">
          <span>
            = {num(severity.raw, lang, 2)} → {num(severity.score, lang)} {t.outOf}
          </span>
        </li>
      </ul>
    </div>
  );
}
