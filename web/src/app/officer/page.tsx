import { Suspense } from "react";
import { getOfficerQueue } from "@/app/officer/actions";
import { SeverityBadge, SeverityBreakdown } from "@/components/issues/severity-breakdown";
import { OfficerQueue } from "@/components/officer/officer-queue";
import { AssignForm, OverrideForm, ReleaseButton, ReviewForm } from "@/components/officer/officer-forms";
import { RoleGate } from "@/components/role-gate";
import { PaymentLine, WorkOrderStepper, WorkOrderSummary } from "@/components/work-orders/work-order-card";
import { listAssignees, listIssueWorkOrders, listOrderFlags } from "@/lib/dashboard";
import { dateTime } from "@/lib/format";
import { googleMapsUrl } from "@/lib/geo";
import { dict, num, type Dict, type Lang } from "@/lib/i18n";
import { getIssue } from "@/lib/issues";
import { readQueueSelection } from "@/lib/officer-queue";
import { getSession } from "@/lib/session";
import { listIssueHistory, listOffers, type OfficerQueueItem } from "@/lib/workflow";

// Assigning cites the policy via an embedding lookup; leave headroom.
export const maxDuration = 60;

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

  const { selectedId } = readQueueSelection(new URLSearchParams(typeof query.issue === "string" ? { issue: query.issue } : {}));
  const [all, flags] = await Promise.all([loadQueue(), listOrderFlags()]);

  return (
    <OfficerQueue all={all} flagEntries={[...flags]} panelIssueId={selectedId} lang={lang}
      t={{ officer: t.officer, issueType: t.issueType, visualClass: t.visualClass, common: t.common, status: t.status }}>
      {selectedId && (
        <Suspense key={selectedId} fallback={<p className="label-small">{t.common.loading}</p>}>
          <IssuePanel issueId={selectedId} lang={lang} />
        </Suspense>
      )}
    </OfficerQueue>
  );
}

// Fetch all pages so a less common issue type is not lost behind the initial severity-ranked page.
async function loadQueue(): Promise<OfficerQueueItem[]> {
  const items: OfficerQueueItem[] = [];
  const pageSize = 300;
  for (let offset = 0; ; offset += pageSize) {
    const page = await getOfficerQueue({ limit: pageSize, offset });
    items.push(...page);
    if (page.length < pageSize) return items;
  }
}

async function IssuePanel({ issueId, lang }: { issueId: number; lang: Lang }) {
  const t = dict(lang);
  const [issue, orders, assignees, history, offers] = await Promise.all([
    getIssue(issueId),
    listIssueWorkOrders(issueId),
    listAssignees(),
    listIssueHistory(issueId),
    listOffers(issueId),
  ]);
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
            {[issue.road_name ?? t.common.noRoad, lang === "bn" ? (issue.area_bn ?? issue.area_en) : issue.area_en, dateTime(issue.created_at, lang)]
              .filter(Boolean)
              .join(" · ")}
          </p>
          <a href={googleMapsUrl(issue.lat, issue.lng)} target="_blank" rel="noopener noreferrer" className="text-link" style={{ fontSize: "0.85rem" }}>
            {t.common.openInMaps} ↗
          </a>
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

      {canAssign && offers.length > 0 && (
        <section className="panel">
          <div className="title-medium">{t.officer.offersTitle}</div>
          <p className="body-medium" style={{ fontSize: "0.85rem", margin: "4px 0 8px" }}>
            {t.officer.offersHelp}
          </p>
          <ul className="factor-list">
            {offers.map((o) => (
              <li key={o.id}>
                <span>
                  <span style={{ fontWeight: 500 }}>{o.ngoName}</span>
                  {o.note && (
                    <span className="label-small" style={{ display: "block" }}>
                      {o.note}
                    </span>
                  )}
                </span>
                <span className="label-small">{dateTime(o.createdAt, lang)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

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

      <IssueHistory entries={history} t={t} lang={lang} />
    </div>
  );
}

type HistoryEntry = Awaited<ReturnType<typeof listIssueHistory>>[number];

/** Short detail for the entries where the payload says something an officer needs. */
function historyDetail(e: HistoryEntry, t: Dict): string | null {
  const p = (e.payload ?? {}) as Record<string, unknown>;
  switch (e.action) {
    case "ai_override":
      return typeof p.reason === "string" ? p.reason : null;
    case "repair_proof_submitted":
      return typeof p.verdict === "string" ? (t.verdict[p.verdict as keyof Dict["verdict"]] ?? p.verdict) : null;
    case "repair_reviewed":
      return [p.decision, p.reason].filter((v) => typeof v === "string").join(": ") || null;
    case "repair_disputed":
    case "ngo_offer":
      return typeof p.comment === "string" ? p.comment : typeof p.note === "string" ? p.note : null;
    default:
      return null;
  }
}

/** Every recorded step for this issue, oldest first (the original AI result and each correction). */
function IssueHistory({ entries, t, lang }: { entries: HistoryEntry[]; t: Dict; lang: Lang }) {
  return (
    <details className="panel">
      <summary className="title-medium" style={{ cursor: "pointer" }}>
        {t.officer.historyTitle} ({num(entries.length, lang)})
      </summary>
      {entries.length === 0 ? (
        <p className="body-medium" style={{ marginTop: 8 }}>
          {t.officer.historyEmpty}
        </p>
      ) : (
        <ul className="factor-list" style={{ marginTop: 8 }}>
          {entries.map((e) => {
            const detail = historyDetail(e, t);
            return (
              <li key={e.id} style={{ alignItems: "flex-start" }}>
                <span>
                  <span style={{ fontWeight: 500 }} title={e.action}>
                    {t.auditActions[e.action] ?? e.action}
                  </span>
                  <span className="label-small" style={{ display: "block" }}>
                    {e.actor_name}
                    {detail ? ` · ${detail}` : ""}
                  </span>
                </span>
                <span className="label-small" style={{ whiteSpace: "nowrap" }}>
                  {dateTime(e.created_at, lang)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </details>
  );
}
