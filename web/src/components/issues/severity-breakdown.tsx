import { num, type Dict, type Lang } from "@/lib/i18n";
import { severityTone } from "@/lib/format";
import type { SeverityResult } from "@/lib/severity";

/** "8 / 10" with a thin 10-step meter, coloured by severity band. */
export function SeverityScore({ score, lang }: { score: number; lang: Lang }) {
  return (
    <span className={`score ${severityTone(score)}`}>
      {num(score, lang)} / {num(10, lang)}
      <span className="score-meter" aria-hidden>
        <span style={{ width: `${score * 10}%` }} />
      </span>
    </span>
  );
}

/** Large score for the issue header. */
export function SeverityBadge({ score, lang }: { score: number; lang: Lang }) {
  const tone = severityTone(score);
  const color = tone === "critical" ? "var(--md-error)" : tone === "moderate" ? "var(--md-tertiary)" : "var(--md-success)";
  return (
    <span className="inline-flex shrink-0 items-baseline gap-1" style={{ color, lineHeight: 1 }}>
      <span style={{ fontSize: "2.2rem", fontWeight: 600 }}>{num(score, lang)}</span>
      <span className="label-small">/ {num(10, lang)}</span>
    </span>
  );
}

/** Every factor behind the score, so citizens and officers can check it. */
export function SeverityBreakdown({ severity, lang, t }: { severity: SeverityResult; lang: Lang; t: Dict["issue"] }) {
  return (
    <div className="panel">
      <div className="eyebrow" style={{ marginBottom: 6 }}>
        {t.why}
      </div>
      <ul className="factor-list">
        {severity.components.map((c) => (
          <li key={c.key}>
            <span>
              <span style={{ fontWeight: 500 }}>{lang === "bn" ? c.labelBn : c.label}</span>
              <span className="label-small" style={{ display: "block" }}>
                {lang === "bn" ? c.detailBn : c.detail}
              </span>
            </span>
            <strong style={{ opacity: c.points > 0 ? 1 : 0.5, fontVariantNumeric: "tabular-nums" }}>
              +{num(c.points, lang, 2)}
            </strong>
          </li>
        ))}
        <li className="total">
          <span>
            = {num(severity.raw, lang, 2)} → {num(severity.score, lang)} {t.outOf}
          </span>
        </li>
      </ul>
    </div>
  );
}
