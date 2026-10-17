import Link from "next/link";
import { Suspense } from "react";
import { ReportForm } from "@/components/citizen/report-form";
import { SeverityBadge } from "@/components/issues/severity-breakdown";
import { dict, type Lang } from "@/lib/i18n";
import { listReportsBy } from "@/lib/issues";
import { DEMO_PERSONA } from "@/lib/roles";
import { getSession } from "@/lib/session";

// The report action runs Gemini + Groq (~10 s); leave headroom on serverless platforms.
export const maxDuration = 60;

export default function CitizenPage() {
  return (
    <Suspense fallback={<div className="h-96" />}>
      <CitizenHome />
    </Suspense>
  );
}

async function CitizenHome() {
  const { lang } = await getSession();
  const t = dict(lang);
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
      <ReportForm t={{ citizen: t.citizen, errors: t.errors }} lang={lang} />
      <section>
        <h2 className="mb-3 font-semibold">{t.citizen.myReports}</h2>
        <Suspense fallback={<p className="text-sm text-muted">…</p>}>
          <MyReports lang={lang} />
        </Suspense>
      </section>
    </div>
  );
}

async function MyReports({ lang }: { lang: Lang }) {
  const t = dict(lang);
  const reports = await listReportsBy(DEMO_PERSONA.citizen);
  if (reports.length === 0) return <p className="text-sm text-muted">{t.citizen.noReports}</p>;
  return (
    <ul className="space-y-2">
      {reports.map((r) => (
        <li key={r.id}>
          <Link
            href={`/citizen/issues/${r.issue.id}`}
            className="flex items-start gap-3 rounded-md border border-line bg-surface p-3 hover:border-accent"
          >
            <SeverityBadge score={r.issue.severity} lang={lang} />
            <div className="min-w-0">
              <p className="font-medium">
                {t.issueType[r.issue.issue_type]} · <span className="text-muted">{t.status[r.issue.status]}</span>
              </p>
              <p className="truncate text-sm text-muted">
                {(lang === "bn" ? r.issue.ai_reason_bn : null) ?? r.issue.ai_reason_en}
              </p>
              <p className="text-xs text-muted">
                {new Date(r.created_at).toLocaleString(lang === "bn" ? "bn-BD" : "en-GB", {
                  dateStyle: "medium",
                  timeStyle: "short",
                  timeZone: "Asia/Dhaka",
                })}
                {r.merged_as_duplicate ? ` · ${t.citizen.mergedTag}` : ""}
              </p>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
