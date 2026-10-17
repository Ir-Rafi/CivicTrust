import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { SeverityBadge, SeverityBreakdown } from "@/components/issues/severity-breakdown";
import { StatusTimeline } from "@/components/issues/status-timeline";
import { dict, num } from "@/lib/i18n";
import { getIssue } from "@/lib/issues";
import { getSession } from "@/lib/session";

export default function IssuePage({ params, searchParams }: PageProps<"/citizen/issues/[id]">) {
  return (
    <Suspense fallback={<div className="h-96" />}>
      <IssueView params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function IssueView({ params, searchParams }: PageProps<"/citizen/issues/[id]">) {
  const [{ id }, query, { lang }] = await Promise.all([params, searchParams, getSession()]);
  const t = dict(lang);
  const issueId = Number(id);
  const issue = Number.isInteger(issueId) ? await getIssue(issueId) : null;

  if (!issue) {
    return (
      <div className="space-y-3">
        <Link href="/citizen" className="text-sm text-accent">{t.issue.back}</Link>
        <p>{t.issue.notFound}</p>
      </div>
    );
  }

  const stored = issue.severity_components;
  const analysis = stored.analysis;
  const reasonPrimary = lang === "bn" ? (issue.ai_reason_bn ?? issue.ai_reason_en) : issue.ai_reason_en;
  const reasonSecondary = lang === "bn" ? (issue.ai_reason_bn ? issue.ai_reason_en : null) : issue.ai_reason_bn;

  return (
    <div className="space-y-5">
      <Link href="/citizen" className="text-sm text-accent">{t.issue.back}</Link>

      {query.new && (
        <p className="flex items-start gap-2 rounded-md bg-accent/10 px-3 py-2 text-sm">
          <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-accent" aria-hidden /> {t.issue.newBanner}
        </p>
      )}
      {query.merged && (
        <p className="flex items-start gap-2 rounded-md bg-warning/10 px-3 py-2 text-sm">
          <Info size={18} className="mt-0.5 shrink-0 text-warning" aria-hidden /> {t.issue.mergedBanner}
        </p>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-3">
          {issue.photoUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL from private storage
            <img src={issue.photoUrl} alt={t.issueType[issue.issue_type]} className="w-full rounded-lg object-cover" />
          )}
          <p className="text-xs text-muted">
            {t.issue.reportedAt}:{" "}
            {new Date(issue.created_at).toLocaleString(lang === "bn" ? "bn-BD" : "en-GB", {
              dateStyle: "medium",
              timeStyle: "short",
              timeZone: "Asia/Dhaka",
            })}
            {" · "}
            {t.issue.reports}: {num(issue.report_count, lang)}
            {issue.road_name ? ` · ${issue.road_name}` : ""}
          </p>
        </div>

        <div className="space-y-5">
          <div className="flex items-center gap-4">
            <SeverityBadge score={issue.severity} lang={lang} size="lg" />
            <div>
              <p className="text-sm text-muted">
                {t.issue.severity} · {t.issue.outOf}
              </p>
              <h1 className="text-xl font-semibold">
                {t.issueType[issue.issue_type]} · {t.visualClass[issue.visual_class]}
              </h1>
            </div>
          </div>

          {reasonPrimary && (
            <div>
              <h2 className="mb-1 text-sm font-semibold">{t.issue.reason}</h2>
              <p>{reasonPrimary}</p>
              {reasonSecondary && <p className="mt-1 text-sm text-muted">{reasonSecondary}</p>}
            </div>
          )}

          <div className="space-y-2">
            <h2 className="text-sm font-semibold">{t.issue.status}</h2>
            <StatusTimeline status={issue.status} t={t.status} />
            <p className="text-xs text-muted">
              {issue.status === "verified" ? t.issue.verifiedNote : issue.status === "reported" ? t.issue.reportedNote : null}
            </p>
          </div>

          <SeverityBreakdown severity={stored} lang={lang} t={t.issue} />

          {analysis && (
            <details className="rounded-md border border-line p-3 text-sm">
              <summary className="cursor-pointer font-semibold">{t.issue.aiDetails}</summary>
              <dl className="mt-2 space-y-2">
                <div>
                  <dt className="text-muted">{t.issue.confidence}</dt>
                  <dd>{num(Math.round((issue.ai_confidence ?? 0) * 100), lang)}%</dd>
                </div>
                <div>
                  <dt className="text-muted">{t.issue.observations}</dt>
                  <dd lang="en">{analysis.observations}</dd>
                </div>
                {analysis.hazards.length > 0 && (
                  <div>
                    <dt className="text-muted">{t.issue.hazards}</dt>
                    <dd lang="en">
                      <ul className="list-disc pl-5">
                        {analysis.hazards.map((h) => (
                          <li key={h}>{h}</li>
                        ))}
                      </ul>
                    </dd>
                  </div>
                )}
              </dl>
              {analysis.people_or_plates_visible && (
                <p className="mt-2 flex items-start gap-1.5 text-warning">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden /> {t.issue.privacy}
                </p>
              )}
            </details>
          )}
        </div>
      </div>
    </div>
  );
}
