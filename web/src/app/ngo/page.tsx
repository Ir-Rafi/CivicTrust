import { Suspense } from "react";
import { SeverityScore } from "@/components/issues/severity-breakdown";
import { RoleGate } from "@/components/role-gate";
import { CrewWorkspace } from "@/components/work-orders/crew-workspace";
import { listVolunteerCandidates } from "@/lib/dashboard";
import { dateOnly } from "@/lib/format";
import { dict, num, type Lang } from "@/lib/i18n";
import { getSession } from "@/lib/session";

export const maxDuration = 60;

export default function NgoPage({ searchParams }: PageProps<"/ngo">) {
  return (
    <Suspense fallback={<div style={{ height: 480 }} />}>
      <NgoView searchParams={searchParams} />
    </Suspense>
  );
}

async function NgoView({ searchParams }: Pick<PageProps<"/ngo">, "searchParams">) {
  const [{ lang, role }, query] = await Promise.all([getSession(), searchParams]);
  if (role !== "ngo") return <RoleGate role="ngo" lang={lang} />;
  const t = dict(lang);
  return (
    <div className="stack" style={{ gap: 24 }}>
      <section>
        <h1 className="headline-medium">{t.ngo.title}</h1>
        <p className="body-medium" style={{ maxWidth: 720, marginTop: 6 }}>
          {t.ngo.subtitle}
        </p>
      </section>
      <CrewWorkspace kind="ngo" lang={lang} query={query} />
      <Suspense fallback={<p className="label-small">{t.common.loading}</p>}>
        <Candidates lang={lang} />
      </Suspense>
    </div>
  );
}

async function Candidates({ lang }: { lang: Lang }) {
  const t = dict(lang);
  const items = await listVolunteerCandidates();
  return (
    <section className="card">
      <div className="card-head">
        <div>
          <h2 className="headline-small">{t.ngo.candidates}</h2>
          <p className="label-small">{t.ngo.candidatesNote}</p>
        </div>
      </div>
      {items.length === 0 ? (
        <p className="body-medium">{t.ngo.candidatesEmpty}</p>
      ) : (
        <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
          {items.map((i) => (
            <div key={i.id} className="card card-low">
              <div className="flex items-center justify-between gap-2">
                <span className="tag moderate">{t.issueType[i.issue_type]}</span>
                <span className="label-small">#CT-{i.id}</span>
              </div>
              <div className="title-medium" style={{ margin: "8px 0 4px" }}>
                {i.road_name ?? t.common.noRoad}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <SeverityScore score={i.severity} lang={lang} />
                <span className="label-small">
                  {t.common.reports}: {num(i.report_count, lang)} · {dateOnly(i.created_at, lang)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
