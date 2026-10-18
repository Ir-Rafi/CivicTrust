import Link from "next/link";
import { Suspense } from "react";
import { getOfficerQueue } from "@/app/officer/actions";
import { SeverityBadge, SeverityBreakdown, SeverityScore } from "@/components/issues/severity-breakdown";
import { IssueMapLazy } from "@/components/officer/issue-map-lazy";
import { AssignForm, OverrideForm, ReleaseButton, ReviewForm } from "@/components/officer/officer-forms";
import { RoleGate } from "@/components/role-gate";
import { PaymentLine, WorkOrderStepper, WorkOrderSummary } from "@/components/work-orders/work-order-card";
import { ISSUE_TYPES, type IssueType } from "@/lib/ai/schemas";
import { listAssignees, listIssueWorkOrders, listOrderFlags, type OrderFlag } from "@/lib/dashboard";
import { dateTime, statusTone } from "@/lib/format";
import { dict, num, type Lang } from "@/lib/i18n";
import { getIssue } from "@/lib/issues";
import { getSession } from "@/lib/session";
import type { OfficerQueueItem } from "@/lib/workflow";

// Assigning cites the policy via an embedding lookup; leave headroom.
export const maxDuration = 60;

const FILTERS = ["open", "new", "critical", "action", "all"] as const;
type Filter = (typeof FILTERS)[number];
const CLOSED = ["fixed", "confirmed", "rejected"];

function applyFilter(items: OfficerQueueItem[], filter: Filter, flags: Map<number, OrderFlag>) {
  switch (filter) {
    case "open":
      return items.filter((i) => !CLOSED.includes(i.status) || flags.has(i.id));
    case "new":
      return items.filter((i) => i.status === "reported" || i.status === "verified");
    case "critical":
      return items.filter((i) => i.severity >= 8 && !CLOSED.includes(i.status));
    case "action":
      return items.filter((i) => flags.has(i.id));
    default:
      return items;
  }
}

export default function OfficerPage({ searchParams }: PageProps<"/officer">) {
  return (
    <Suspense fallback={<div style={{ height: 480 }} />}>
      <OfficerView searchParams={searchParams} />
    </Suspense>
  );
}

async function OfficerView({ searchParams }: Pick<PageProps<"/officer">, "searchParams">) {
  const [{ lang, role }, query] = await Promise.all([getSession(), searchParams]);
  if (role !== "officer") return <RoleGate role="officer" lang={lang} />;
  const t = dict(lang);

  const filter: Filter = FILTERS.includes(query.f as Filter) ? (query.f as Filter) : "open";
  const type = ISSUE_TYPES.includes(query.type as IssueType) ? (query.type as IssueType) : undefined;
  const selectedId = Number(query.issue) || null;

  const [all, flags] = await Promise.all([getOfficerQueue({ issueType: type, limit: 300 }), listOrderFlags()]);
  const items = applyFilter(all, filter, flags);

  const href = (next: { f?: Filter; type?: string | null; issue?: number | null }) => {
    const p = new URLSearchParams();
    const f = next.f ?? filter;
    if (f !== "open") p.set("f", f);
    const ty = next.type === null ? undefined : (next.type ?? type);
    if (ty) p.set("type", ty);
    const is = next.issue === null ? undefined : (next.issue ?? selectedId);
    if (is) p.set("issue", String(is));
    const qs = p.toString();
    return qs ? `/officer?${qs}` : "/officer";
  };
  const filterLabel: Record<Filter, string> = {
    open: t.officer.filterOpen,
    new: t.officer.filterNew,
    critical: t.officer.filterCritical,
    action: t.officer.filterAction,
    all: t.officer.filterAll,
  };

  return (
    <div className="asymmetric-grid">
      <div className="stack" style={{ gap: 24 }}>
        <section className="card">
          <div className="card-head" style={{ flexWrap: "wrap" }}>
            <div>
              <h1 className="headline-small">{t.officer.title}</h1>
              <p className="label-small" style={{ maxWidth: 520 }}>
                {t.officer.subtitle}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3" style={{ marginBottom: 16 }}>
            <nav className="filter-group" aria-label={t.officer.colStatus}>
              {FILTERS.map((f) => (
                <Link key={f} href={href({ f, issue: null })} className="filter-link" aria-current={f === filter ? "true" : undefined}>
                  {filterLabel[f]}
                </Link>
              ))}
            </nav>
            <nav className="filter-group" aria-label={t.officer.filterType}>
              <Link href={href({ type: null, issue: null })} className="filter-link" aria-current={!type ? "true" : undefined}>
                {t.officer.anyType}
              </Link>
              {ISSUE_TYPES.filter((v) => v !== "other").map((v) => (
                <Link key={v} href={href({ type: v, issue: null })} className="filter-link" aria-current={v === type ? "true" : undefined}>
                  {t.issueType[v]}
                </Link>
              ))}
            </nav>
          </div>

          {items.length === 0 ? (
            <p className="body-medium">{t.officer.empty}</p>
          ) : (
            <div className="table-wrap">
              <table className="md-table">
                <thead>
                  <tr>
                    <th>{t.officer.colTicket}</th>
                    <th>{t.officer.colDefect}</th>
                    <th>{t.officer.colSeverity}</th>
                    <th>{t.officer.colStatus}</th>
                    <th className="num">{t.officer.colReports}</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((i) => {
                    const flag = flags.get(i.id);
                    return (
                      <tr key={i.id} className={i.id === selectedId ? "is-selected" : undefined}>
                        <td>
                          <Link href={href({ issue: i.id })} scroll={false} className="row-link">
                            <strong>#CT-{i.id}</strong>
                          </Link>
                        </td>
                        <td>
                          <Link href={href({ issue: i.id })} scroll={false} className="row-link">
                            <strong style={{ fontWeight: 500 }}>
                              {t.issueType[i.issue_type]} · {t.visualClass[i.visual_class]}
                            </strong>
                            <span className="label-small" style={{ display: "block" }}>
                              {i.road_name ?? t.common.noRoad}
                            </span>
                          </Link>
                        </td>
                        <td>
                          <SeverityScore score={i.severity} lang={lang} />
                        </td>
                        <td>
                          <span className={`tag ${statusTone(i.status)}`}>{t.status[i.status as keyof typeof t.status] ?? i.status}</span>
                          {flag && (
                            <span className="tag warning" style={{ display: "flex", marginTop: 4 }}>
                              {flag === "review" ? t.officer.flagReview : t.officer.flagPayable}
                            </span>
                          )}
                        </td>
                        <td className="num">{num(i.report_count, lang)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="card card-low">
          <div className="card-head">
            <h2 className="title-medium">{t.officer.mapTitle}</h2>
          </div>
          <div className="map-frame">
            <IssueMapLazy
              points={items.map((i) => ({ id: i.id, lat: i.lat, lng: i.lng, severity: i.severity, label: `#CT-${i.id} · ${t.issueType[i.issue_type]}` }))}
              selectedId={selectedId}
            />
          </div>
          <p className="label-small" style={{ marginTop: 10 }}>
            {t.officer.mapNote}
          </p>
        </section>
      </div>

      <aside className="card card-high">
        {selectedId ? (
          <Suspense key={selectedId} fallback={<p className="label-small">{t.common.loading}</p>}>
            <IssuePanel issueId={selectedId} lang={lang} />
          </Suspense>
        ) : (
          <p className="body-medium">{t.officer.selectHint}</p>
        )}
      </aside>
    </div>
  );
}

async function IssuePanel({ issueId, lang }: { issueId: number; lang: Lang }) {
  const t = dict(lang);
  const [issue, orders, assignees] = await Promise.all([getIssue(issueId), listIssueWorkOrders(issueId), listAssignees()]);
  if (!issue) return <p className="body-medium">{t.issue.notFound}</p>;

  const stored = issue.severity_components;
  const active = orders.find((o) => ["open", "in_progress", "submitted", "approved"].includes(o.status));
  const closedIssue = ["fixed", "confirmed", "rejected"].includes(issue.status);
  const canAssign = !closedIssue && !orders.some((o) => ["open", "in_progress", "submitted"].includes(o.status));
  const reason = lang === "bn" ? (issue.ai_reason_bn ?? issue.ai_reason_en) : issue.ai_reason_en;
  const formT = { officer: t.officer, issueType: t.issueType, visualClass: t.visualClass, common: t.common };

  return (
    <div className="stack">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="eyebrow">#CT-{issue.id} · {t.officer.aiEvidence}</div>
          <h2 className="headline-small" style={{ marginTop: 4 }}>
            {t.issueType[issue.issue_type]} · {t.visualClass[issue.visual_class]}
          </h2>
          <p className="label-small">
            {issue.road_name ?? t.common.noRoad} · {dateTime(issue.created_at, lang)}
          </p>
          {stored.officer_score !== undefined && (
            <span className="tag primary" style={{ marginTop: 4 }}>
              {t.officer.overridden}
            </span>
          )}
        </div>
        <SeverityBadge score={issue.severity} lang={lang} />
      </div>

      {issue.photoUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- signed URL from private storage
        <img src={issue.photoUrl} alt="" className="photo" style={{ maxHeight: 240 }} />
      )}

      {reason && (
        <div className="panel">
          <div className="eyebrow" style={{ marginBottom: 4 }}>
            {t.issue.reason}
          </div>
          <p style={{ fontSize: "0.88rem" }}>{reason}</p>
          <p className="label-small" style={{ marginTop: 6 }}>
            {t.officer.confidence}: {num(Math.round((issue.ai_confidence ?? 0) * 100), lang)}%
          </p>
        </div>
      )}

      <SeverityBreakdown severity={stored} lang={lang} t={t.issue} />

      <section className="panel">
        <div className="eyebrow" style={{ marginBottom: 8 }}>
          {t.officer.workOrders}
        </div>
        {orders.length === 0 && <p className="body-medium">{t.officer.noWorkOrders}</p>}
        {active && (
          <div className="stack" style={{ gap: 12 }}>
            <WorkOrderStepper order={active} citizenConfirmed={issue.status === "confirmed"} lang={lang} />
            <WorkOrderSummary order={active} lang={lang} />
            {active.status === "submitted" && active.proofs[0] && (
              <div className="stack" style={{ gap: 10 }}>
                <div className="title-medium">{t.officer.reviewTitle}</div>
                <p className="body-medium" style={{ fontSize: "0.85rem" }}>
                  {t.officer.reviewHelp}
                </p>
                <div className="photo-pair">
                  {issue.photoUrl && (
                    <figure>
                      {/* eslint-disable-next-line @next/next/no-img-element -- signed URL */}
                      <img src={issue.photoUrl} alt="" className="photo" style={{ aspectRatio: "4 / 3" }} />
                      <figcaption className="label-small">{t.common.before}</figcaption>
                    </figure>
                  )}
                  {active.proofs[0].photoUrl && (
                    <figure>
                      {/* eslint-disable-next-line @next/next/no-img-element -- signed URL */}
                      <img src={active.proofs[0].photoUrl} alt="" className="photo" style={{ aspectRatio: "4 / 3" }} />
                      <figcaption className="label-small">{t.common.after}</figcaption>
                    </figure>
                  )}
                </div>
                <ReviewForm workOrderId={active.id} t={formT} />
              </div>
            )}
            <PaymentLine order={active} lang={lang} />
            {active.status === "approved" && active.payment_status === "eligible" && issue.status !== "disputed" && (
              <div>
                <p className="label-small" style={{ marginBottom: 8 }}>
                  {t.officer.releaseHelp}
                </p>
                <ReleaseButton workOrderId={active.id} label={t.officer.release} />
              </div>
            )}
          </div>
        )}
        {!active && orders[0] && <WorkOrderSummary order={orders[0]} lang={lang} />}
      </section>

      {canAssign && (
        <section className="panel">
          <div className="title-medium">{t.officer.assignTitle}</div>
          <p className="body-medium" style={{ fontSize: "0.85rem", margin: "4px 0 12px" }}>
            {t.officer.assignHelp}
          </p>
          <AssignForm issueId={issue.id} contractors={assignees.contractors} ngos={assignees.ngos} t={formT} />
        </section>
      )}

      {!closedIssue ? (
        <details className="panel">
          <summary className="title-medium" style={{ cursor: "pointer" }}>
            {t.officer.overrideTitle}
          </summary>
          <p className="body-medium" style={{ fontSize: "0.85rem", margin: "6px 0 12px" }}>
            {t.officer.overrideHelp}
          </p>
          <OverrideForm
            issueId={issue.id}
            current={{ issueType: issue.issue_type, visualClass: issue.visual_class, severity: issue.severity }}
            t={formT}
          />
        </details>
      ) : (
        !active && <p className="label-small">{t.officer.closed}</p>
      )}
    </div>
  );
}
