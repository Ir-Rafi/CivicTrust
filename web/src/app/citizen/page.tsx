import Link from "next/link";
import { Suspense } from "react";
import { ReportForm } from "@/components/citizen/report-form";
import { SeverityScore } from "@/components/issues/severity-breakdown";
import { dateTime, statusTone } from "@/lib/format";
import { dict, type Lang } from "@/lib/i18n";
import { listReportsBy } from "@/lib/issues";
import { DEMO_PERSONA } from "@/lib/roles";
import { getSession } from "@/lib/session";

// The report action runs Gemini + Groq (~10 s); leave headroom on serverless platforms.
export const maxDuration = 60;

export default function CitizenPage() {
  return (
    <Suspense fallback={<div style={{ height: 480 }} />}>
      <CitizenHome />
    </Suspense>
  );
}

async function CitizenHome() {
  const { lang } = await getSession();
  const t = dict(lang);
  return (
    <div className="asymmetric-grid">
      <ReportForm t={{ citizen: t.citizen, errors: t.errors }} lang={lang} />
      <section className="card card-high">
        <div className="eyebrow" style={{ marginBottom: 12 }}>
          {t.citizen.myReports}
        </div>
        <Suspense fallback={<p className="label-small">{t.common.loading}</p>}>
          <MyReports lang={lang} />
        </Suspense>
      </section>
    </div>
  );
}

async function MyReports({ lang }: { lang: Lang }) {
  const t = dict(lang);
  const reports = await listReportsBy(DEMO_PERSONA.citizen);
  if (reports.length === 0) return <p className="body-medium">{t.citizen.noReports}</p>;
  return (
    <ul className="stack" style={{ gap: 10 }}>
      {reports.map((r) => (
        <li key={r.id}>
          <Link href={`/citizen/issues/${r.issue.id}`} className="panel card-link">
            <div className="flex items-center justify-between gap-3">
              <span className="title-medium">{t.issueType[r.issue.issue_type]}</span>
              <SeverityScore score={r.issue.severity} lang={lang} />
            </div>
            <p className="body-medium truncate" style={{ fontSize: "0.85rem", marginTop: 2 }}>
              {(lang === "bn" ? r.issue.ai_reason_bn : null) ?? r.issue.ai_reason_en}
            </p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1" style={{ marginTop: 8 }}>
              <span className={`tag ${statusTone(r.issue.status)}`}>{t.status[r.issue.status]}</span>
              <span className="label-small">
                {dateTime(r.created_at, lang)}
                {r.merged_as_duplicate ? ` · ${t.citizen.mergedTag}` : ""}
              </span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

