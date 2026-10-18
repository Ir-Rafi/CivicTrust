import { Suspense } from "react";
import { getPublicContractorScorecards, getPublicWardStats } from "@/app/public/actions";
import { getIssueTotals, getPaymentSummary, listRecentFixes } from "@/lib/dashboard";
import { dateOnly, statusTone, taka } from "@/lib/format";
import { dict, fill, num, type Lang } from "@/lib/i18n";
import { getSession } from "@/lib/session";

type WardRow = { ward_id: number; ward_name_en: string; ward_name_bn: string | null; open_count: number; fixed_count: number; avg_fix_hours: number | null };
type Scorecard = {
  contractor_id: number;
  contractor_name: string;
  company: string | null;
  assigned_count: number;
  approved_count: number;
  rejected_count: number;
  disputed_count: number;
  on_time_rate: number | string | null;
};

export default function PublicPage() {
  return (
    <Suspense fallback={<div style={{ height: 480 }} />}>
      <PublicView />
    </Suspense>
  );
}

async function PublicView() {
  const { lang } = await getSession();
  const t = dict(lang);
  return (
    <div className="stack" style={{ gap: 24 }}>
      <section>
        <h1 className="headline-medium">{t.publicPortal.title}</h1>
        <p className="body-medium" style={{ maxWidth: 720, marginTop: 6 }}>
          {t.publicPortal.subtitle}
        </p>
      </section>
      <Suspense fallback={<div style={{ height: 140 }} />}>
        <Headline lang={lang} />
      </Suspense>
      <Suspense fallback={<div style={{ height: 200 }} />}>
        <Scorecards lang={lang} />
      </Suspense>
      <div className="asymmetric-grid">
        <Suspense fallback={<div style={{ height: 200 }} />}>
          <ByArea lang={lang} />
        </Suspense>
        <Suspense fallback={<div style={{ height: 200 }} />}>
          <RecentFixes lang={lang} />
        </Suspense>
      </div>
    </div>
  );
}

function Metric({ label, value, note, color }: { label: string; value: string; note?: string; color?: string }) {
  return (
    <div className="card card-high">
      <div className="label-small" style={{ textTransform: "uppercase" }}>
        {label}
      </div>
      <div style={{ fontSize: "2rem", fontWeight: 600, color: color ?? "var(--md-on-surface)", margin: "6px 0", fontVariantNumeric: "tabular-nums" }}>
        {value}
      </div>
      {note && <div className="label-small">{note}</div>}
    </div>
  );
}

async function Headline({ lang }: { lang: Lang }) {
  const t = dict(lang);
  const [totals, money] = await Promise.all([getIssueTotals(), getPaymentSummary()]);
  const rate = totals.total ? Math.round((totals.fixed / totals.total) * 1000) / 10 : 0;
  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
      <Metric label={t.publicPortal.total} value={num(totals.total, lang)} note={t.publicPortal.pilotZone} color="var(--md-primary)" />
      <Metric
        label={t.publicPortal.fixed}
        value={num(totals.fixed, lang)}
        note={fill(t.publicPortal.fixedRate, { n: num(rate, lang, 1) })}
        color="var(--md-success)"
      />
      <Metric
        label={t.publicPortal.released}
        value={taka(money.released, lang)}
        note={
          totals.avgFixHours === null
            ? undefined
            : `${t.publicPortal.avgFix}: ${fill(t.publicPortal.hours, { n: num(totals.avgFixHours, lang, 1) })}`
        }
      />
      <Metric label={t.publicPortal.withheld} value={taka(money.withheld, lang)} color="var(--md-error)" />
    </div>
  );
}

async function Scorecards({ lang }: { lang: Lang }) {
  const t = dict(lang);
  const rows = (await getPublicContractorScorecards()) as Scorecard[];
  return (
    <section className="card">
      <div className="card-head">
        <div>
          <h2 className="headline-small">{t.publicPortal.scorecards}</h2>
          <p className="label-small">{t.publicPortal.scorecardsNote}</p>
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="body-medium">{t.publicPortal.noScorecards}</p>
      ) : (
        <div className="table-wrap">
          <table className="md-table">
            <thead>
              <tr>
                <th>{t.publicPortal.colContractor}</th>
                <th className="num">{t.publicPortal.colJobs}</th>
                <th className="num">{t.publicPortal.colApproved}</th>
                <th className="num">{t.publicPortal.colRejected}</th>
                <th className="num">{t.publicPortal.colDisputed}</th>
                <th className="num">{t.publicPortal.colOnTime}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const onTime = r.on_time_rate === null ? null : Number(r.on_time_rate);
                return (
                  <tr key={r.contractor_id}>
                    <td>
                      <strong style={{ fontWeight: 500 }}>{r.contractor_name}</strong>
                      {r.company && (
                        <span className="label-small" style={{ display: "block" }}>
                          {r.company}
                        </span>
                      )}
                    </td>
                    <td className="num">{num(r.assigned_count, lang)}</td>
                    <td className="num" style={{ color: "var(--md-success)", fontWeight: 600 }}>
                      {num(r.approved_count, lang)}
                    </td>
                    <td className="num" style={{ color: r.rejected_count ? "var(--md-error)" : undefined, fontWeight: r.rejected_count ? 600 : undefined }}>
                      {num(r.rejected_count, lang)}
                    </td>
                    <td className="num" style={{ color: r.disputed_count ? "var(--md-error)" : undefined }}>
                      {num(r.disputed_count, lang)}
                    </td>
                    <td className="num">{onTime === null ? <span className="label-small">{t.publicPortal.notDue}</span> : `${num(onTime, lang, 1)}%`}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

async function ByArea({ lang }: { lang: Lang }) {
  const t = dict(lang);
  const wards = (await getPublicWardStats()) as WardRow[];
  const totals = wards.length === 0 ? await getIssueTotals() : null;
  const rows = totals
    ? [{ key: "pilot", name: t.publicPortal.pilotZone, open: totals.open, fixed: totals.fixed, avg: totals.avgFixHours }]
    : wards.map((w) => ({
        key: String(w.ward_id),
        name: (lang === "bn" ? w.ward_name_bn : null) ?? w.ward_name_en,
        open: Number(w.open_count),
        fixed: Number(w.fixed_count),
        avg: w.avg_fix_hours,
      }));
  return (
    <section className="card">
      <h2 className="headline-small" style={{ marginBottom: 12 }}>
        {t.publicPortal.byArea}
      </h2>
      <div className="table-wrap">
        <table className="md-table">
          <thead>
            <tr>
              <th>{t.publicPortal.area}</th>
              <th className="num">{t.publicPortal.open}</th>
              <th className="num">{t.publicPortal.fixedCol}</th>
              <th className="num">{t.publicPortal.avgCol}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key}>
                <td>{r.name}</td>
                <td className="num">{num(r.open, lang)}</td>
                <td className="num">{num(r.fixed, lang)}</td>
                <td className="num">{r.avg === null ? "—" : fill(t.publicPortal.hours, { n: num(r.avg, lang, 1) })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {totals && (
        <p className="label-small" style={{ marginTop: 10 }}>
          {t.publicPortal.noWards}
        </p>
      )}
    </section>
  );
}

async function RecentFixes({ lang }: { lang: Lang }) {
  const t = dict(lang);
  const fixes = await listRecentFixes();
  return (
    <section className="card card-high">
      <h2 className="headline-small" style={{ marginBottom: 12 }}>
        {t.publicPortal.recent}
      </h2>
      {fixes.length === 0 ? (
        <p className="body-medium">{t.publicPortal.recentEmpty}</p>
      ) : (
        <ul className="factor-list">
          {fixes.map((f) => (
            <li key={f.id}>
              <span>
                <span style={{ fontWeight: 500 }}>{t.issueType[f.issue_type]}</span>
                <span className="label-small" style={{ display: "block" }}>
                  {f.road_name ?? t.common.noRoad} · {dateOnly(f.fixed_at, lang)}
                </span>
              </span>
              <span className={`tag ${statusTone(f.status)}`}>{t.status[f.status]}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
