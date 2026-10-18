import { AlertTriangle, ArrowLeft, CheckCircle2, Info } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { FeedbackForm } from "@/components/citizen/feedback-form";
import { SeverityBadge, SeverityBreakdown } from "@/components/issues/severity-breakdown";
import { StatusTimeline } from "@/components/issues/status-timeline";
import { getApprovedRepair } from "@/lib/dashboard";
import { dateTime, statusTone } from "@/lib/format";
import { dict, num, type Lang } from "@/lib/i18n";
import { getIssue, type IssueDetail } from "@/lib/issues";
import { getSession } from "@/lib/session";

export default function IssuePage({ params, searchParams }: PageProps<"/citizen/issues/[id]">) {
  return (
    <Suspense fallback={<div style={{ height: 480 }} />}>
      <IssueView params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function IssueView({ params, searchParams }: PageProps<"/citizen/issues/[id]">) {
  const [{ id }, query, { lang, role }] = await Promise.all([params, searchParams, getSession()]);
  const t = dict(lang);
  const issueId = Number(id);
  const issue = Number.isInteger(issueId) ? await getIssue(issueId) : null;

  const back = (
    <Link href="/citizen" className="text-link inline-flex items-center gap-1" style={{ fontSize: "0.9rem" }}>
      <ArrowLeft size={16} aria-hidden /> {t.issue.back.replace(/^←\s*/, "")}
    </Link>
  );

  if (!issue) {
    return (
      <div className="stack">
        {back}
        <p className="body-medium">{t.issue.notFound}</p>
      </div>
    );
  }

  const stored = issue.severity_components;
  const analysis = stored.analysis;
  const reasonPrimary = lang === "bn" ? (issue.ai_reason_bn ?? issue.ai_reason_en) : issue.ai_reason_en;
  const reasonSecondary = lang === "bn" ? (issue.ai_reason_bn ? issue.ai_reason_en : null) : issue.ai_reason_bn;
  const repaired = ["fixed", "confirmed", "disputed"].includes(issue.status);

  return (
    <div className="stack" style={{ gap: 20 }}>
      {back}

      {query.new && (
        <p className="notice success">
          <CheckCircle2 size={18} className="shrink-0" style={{ color: "var(--md-success)" }} aria-hidden /> {t.issue.newBanner}
        </p>
      )}
      {query.merged && (
        <p className="notice info">
          <Info size={18} className="shrink-0" style={{ color: "var(--md-primary)" }} aria-hidden /> {t.issue.mergedBanner}
        </p>
      )}

      <div className="asymmetric-grid">
        <div className="card stack">
          {issue.photoUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL from private storage
            <img src={issue.photoUrl} alt={t.issueType[issue.issue_type]} className="photo" style={{ maxHeight: 420 }} />
          )}
          <p className="label-small">
            {t.issue.reportedAt}: {dateTime(issue.created_at, lang)} · {t.issue.reports}: {num(issue.report_count, lang)}
            {issue.road_name ? ` · ${issue.road_name}` : ""}
          </p>

          <div>
            <div className="eyebrow">{t.issue.status}</div>
            <StatusTimeline status={issue.status} t={t.status} />
            <p className="label-small">
              {issue.status === "verified" ? t.issue.verifiedNote : issue.status === "reported" ? t.issue.reportedNote : null}
            </p>
          </div>

          {repaired && (
            <Suspense fallback={<p className="label-small">{t.common.loading}</p>}>
              <RepairEvidence issue={issue} lang={lang} canGiveFeedback={role === "citizen"} />
            </Suspense>
          )}
        </div>

        <div className="card card-high stack">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="eyebrow">
                {t.issue.severity} · {t.issue.outOf}
              </div>
              <h1 className="headline-small" style={{ marginTop: 4 }}>
                {t.issueType[issue.issue_type]} · {t.visualClass[issue.visual_class]}
              </h1>
              <span className={`tag ${statusTone(issue.status)}`} style={{ marginTop: 6 }}>
                {t.status[issue.status]}
              </span>
            </div>
            <SeverityBadge score={issue.severity} lang={lang} />
          </div>

          <SeverityBreakdown severity={stored} lang={lang} t={t.issue} />

          {reasonPrimary && (
            <div className="panel">
              <div className="eyebrow" style={{ marginBottom: 6 }}>
                {t.issue.reason}
              </div>
              <p style={{ fontSize: "0.9rem" }}>{reasonPrimary}</p>
              {reasonSecondary && (
                <p
                  className="body-medium"
                  style={{ fontSize: "0.82rem", borderTop: "1px solid var(--md-surface-container-high)", paddingTop: 6, marginTop: 8 }}
                >
                  {reasonSecondary}
                </p>
              )}
            </div>
          )}

          {analysis && (
            <details className="panel" style={{ fontSize: "0.85rem" }}>
              <summary className="title-medium" style={{ cursor: "pointer", fontSize: "0.9rem" }}>
                {t.issue.aiDetails}
              </summary>
              <dl className="stack" style={{ gap: 8, marginTop: 10 }}>
                <div>
                  <dt className="label-small">{t.issue.confidence}</dt>
                  <dd>{num(Math.round((issue.ai_confidence ?? 0) * 100), lang)}%</dd>
                </div>
                <div>
                  <dt className="label-small">{t.issue.observations}</dt>
                  <dd lang="en">{analysis.observations}</dd>
                </div>
                {analysis.hazards.length > 0 && (
                  <div>
                    <dt className="label-small">{t.issue.hazards}</dt>
                    <dd lang="en">
                      <ul style={{ listStyle: "disc", paddingLeft: 20 }}>
                        {analysis.hazards.map((h) => (
                          <li key={h}>{h}</li>
                        ))}
                      </ul>
                    </dd>
                  </div>
                )}
              </dl>
              {analysis.people_or_plates_visible && (
                <p className="notice warning" style={{ marginTop: 10 }}>
                  <AlertTriangle size={16} className="shrink-0" aria-hidden /> {t.issue.privacy}
                </p>
              )}
            </details>
          )}
        </div>
      </div>
    </div>
  );
}

async function RepairEvidence({ issue, lang, canGiveFeedback }: { issue: IssueDetail; lang: Lang; canGiveFeedback: boolean }) {
  const t = dict(lang);
  const repair = await getApprovedRepair(issue.id);
  const proof = repair?.proof;
  return (
    <div className="stack" style={{ gap: 12 }}>
      <div className="eyebrow">{t.citizen.repairTitle}</div>
      {proof && (
        <div className="photo-pair">
          <figure>
            {issue.photoUrl && (
              // eslint-disable-next-line @next/next/no-img-element -- signed URL
              <img src={issue.photoUrl} alt="" className="photo" style={{ aspectRatio: "4 / 3" }} />
            )}
            <figcaption className="label-small" style={{ marginTop: 4 }}>
              {t.common.before}
            </figcaption>
          </figure>
          <figure>
            {proof.photoUrl && (
              // eslint-disable-next-line @next/next/no-img-element -- signed URL
              <img src={proof.photoUrl} alt="" className="photo" style={{ aspectRatio: "4 / 3" }} />
            )}
            <figcaption className="label-small" style={{ marginTop: 4 }}>
              {t.common.after}
            </figcaption>
          </figure>
        </div>
      )}
      {proof?.verdict_reason_en && (
        <p className="body-medium" lang="en" style={{ fontSize: "0.85rem" }}>
          {proof.verdict_reason_en}
        </p>
      )}
      {issue.status === "fixed" && canGiveFeedback && <FeedbackForm issueId={issue.id} t={t.citizen} />}
      {issue.status === "confirmed" && <p className="notice success">{t.citizen.feedbackThanks}</p>}
    </div>
  );
}
