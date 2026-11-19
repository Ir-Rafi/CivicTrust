import { Suspense } from "react";
import { getPublicContractorScorecards, getPublicIssues, getPublicLog, getPublicWardStats } from "@/app/public/actions";
import { getIssueTotals, getPaymentSummary } from "@/lib/dashboard";
import { dateOnly, dateTime, statusTone, taka } from "@/lib/format";
import { dict, fill, num, type Dict, type Lang } from "@/lib/i18n";
import type { PublicEvent, PublicPlace } from "@/lib/public-log";
import { getSession } from "@/lib/session";

type WardRow = { ward_id: number; ward_name_en: string | null; ward_name_bn: string | null; open_count: number; fixed_count: number; avg_fix_hours: number | null };
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
      <div className="asymmetric-grid">
        <Suspense fallback={<div style={{ height: 240 }} />}>
          <Tracker lang={lang} />
        </Suspense>
        <Suspense fallback={<div style={{ height: 240 }} />}>
          <UpdateLog lang={lang} />
        </Suspense>
      </div>
      <Suspense fallback={<div style={{ height: 140 }} />}>
        <Headline lang={lang} />
      </Suspense>
      <Suspense fallback={<div style={{ height: 200 }} />}>
        <Scorecards lang={lang} />
      </Suspense>
      <Suspense fallback={<div style={{ height: 200 }} />}>
        <ByArea lang={lang} />
      </Suspense>
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
  // Negative ids: OpenStreetMap areas, used until official ward boundaries are loaded.
  const osmAreas = wards.some((w) => w.ward_id < 0);
  const rows = totals
    ? [{ key: "pilot", name: t.publicPortal.pilotZone, open: totals.open, fixed: totals.fixed, avg: totals.avgFixHours }]
    : wards.map((w) => ({
        key: String(w.ward_id),
        name: (lang === "bn" ? w.ward_name_bn : null) ?? w.ward_name_en ?? t.publicPortal.otherAreas,
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
      {(totals || osmAreas) && (
        <p className="label-small" style={{ marginTop: 10 }}>
          {totals ? t.publicPortal.noWards : t.publicPortal.areasFromOsm}
        </p>
      )}
    </section>
  );
}

function placeText(place: PublicPlace, t: Dict, lang: Lang): string {
  const area = place.area ? (lang === "bn" ? (place.area.bn ?? place.area.en) : (place.area.en ?? place.area.bn)) : null;
  const near = place.landmark ? fill(t.publicPortal.near, { name: place.landmark.name }) : null;
  return [place.road ?? t.common.noRoad, area, near].filter(Boolean).join(" · ");
}

function Step({ label, at, lang }: { label: string; at: string | null; lang: Lang }) {
  return (
    <span className={`tag ${at ? "verified" : ""}`} title={at ? dateTime(at, lang) : undefined}>
      {label}
      {at && <span className="label-small">{dateOnly(at, lang)}</span>}
    </span>
  );
}

/** Where each problem is and whether it is assigned or fixed. */
async function Tracker({ lang }: { lang: Lang }) {
  const t = dict(lang);
  const issues = await getPublicIssues();
  return (
    <section className="card">
      <div className="card-head">
        <div>
          <h2 className="headline-small">{t.publicPortal.tracker}</h2>
          <p className="label-small">{t.publicPortal.trackerNote}</p>
        </div>
      </div>
      {issues.length === 0 ? (
        <p className="body-medium">{t.publicPortal.trackerEmpty}</p>
      ) : (
        <ul className="factor-list">
          {issues.map((i) => (
            <li key={i.id} style={{ flexDirection: "column", alignItems: "flex-start", gap: 8 }}>
              <span>
                <span style={{ fontWeight: 500 }}>{t.issueType[i.issue_type]}</span>
                <span className="label-small" style={{ display: "block" }}>
                  {placeText(i.place, t, lang)}
                  {i.report_count > 1 && ` · ${fill(t.publicPortal.reportsBy, { n: num(i.report_count, lang) })}`}
                </span>
              </span>
              <span className="flex flex-wrap items-center gap-3">
                <Step label={t.publicPortal.stepReported} at={i.reported_at} lang={lang} />
                <Step label={t.publicPortal.stepAssigned} at={i.assigned_at} lang={lang} />
                <Step label={t.publicPortal.stepFixed} at={i.fixed_at} lang={lang} />
                {(i.stage === "confirmed" || i.stage === "disputed") && (
                  <span className={`tag ${statusTone(i.stage)}`}>{t.status[i.stage]}</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function eventLabel(e: PublicEvent, t: Dict): string {
  switch (e.kind) {
    case "reported":
      return t.publicPortal.evReported;
    case "assigned":
      return t.publicPortal.evAssigned;
    case "fixed":
      return e.verified_by === "officer" ? t.publicPortal.evFixedOfficer : t.publicPortal.evFixedAi;
    case "not_accepted":
      return t.publicPortal.evNotAccepted;
    case "overdue":
      return t.publicPortal.evOverdue;
    case "disputed":
      return t.publicPortal.evDisputed;
    case "confirmed":
      return t.publicPortal.evConfirmed;
  }
}

const EVENT_TONE: Record<PublicEvent["kind"], string> = {
  reported: "moderate",
  assigned: "primary",
  fixed: "verified",
  not_accepted: "critical",
  overdue: "critical",
  disputed: "critical",
  confirmed: "verified",
};

/** Plain-language log, newest first; each line links back to its hash-chained audit record. */
async function UpdateLog({ lang }: { lang: Lang }) {
  const t = dict(lang);
  const events = await getPublicLog();
  return (
    <section className="card card-high">
      <div className="card-head">
        <div>
          <h2 className="headline-small">{t.publicPortal.log}</h2>
          <p className="label-small">{t.publicPortal.logNote}</p>
        </div>
      </div>
      {events.length === 0 ? (
        <p className="body-medium">{t.publicPortal.logEmpty}</p>
      ) : (
        <ul className="factor-list">
          {events.map((e) => (
            <li key={e.id} style={{ alignItems: "flex-start" }}>
              <span>
                <span className={`tag ${EVENT_TONE[e.kind]}`}>{eventLabel(e, t)}</span>
                <span className="label-small" style={{ display: "block", marginTop: 4 }}>
                  {t.issueType[e.issue.issue_type]} · {placeText(e.issue.place, t, lang)}
                </span>
              </span>
              <span className="label-small" style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                {dateTime(e.at, lang)}
                <span style={{ display: "block" }}>
                  {t.publicPortal.auditRecord} #{num(e.id, lang)}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
