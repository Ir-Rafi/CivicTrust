import { ShieldAlert, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { getAuditChainStatus, getAuditEntries } from "@/app/audit/actions";
import { dateTime } from "@/lib/format";
import { dict, fill, num, type Lang } from "@/lib/i18n";
import { getSession } from "@/lib/session";

const ROLE_TONE: Record<string, string> = {
  officer: "primary",
  ai: "verified",
  system: "verified",
  contractor: "moderate",
  ngo: "moderate",
  citizen: "warning",
};

export default function AuditPage() {
  return (
    <Suspense fallback={<div style={{ height: 480 }} />}>
      <AuditView />
    </Suspense>
  );
}

async function AuditView() {
  const { lang } = await getSession();
  const t = dict(lang);
  return (
    <div className="stack" style={{ gap: 24 }}>
      <section>
        <h1 className="headline-medium">{t.auditPage.title}</h1>
        <p className="body-medium" style={{ maxWidth: 720, marginTop: 6 }}>
          {t.auditPage.subtitle}
        </p>
      </section>
      <Suspense fallback={<div className="card" style={{ height: 96 }} />}>
        <ChainStatus lang={lang} />
      </Suspense>
      <Suspense fallback={<div className="card" style={{ height: 240 }} />}>
        <Entries lang={lang} />
      </Suspense>
    </div>
  );
}

async function ChainStatus({ lang }: { lang: Lang }) {
  const t = dict(lang);
  const status = await getAuditChainStatus();
  const intact = status.first_broken_id === null;
  return (
    <div className="card" style={{ background: intact ? "var(--md-primary-container)" : "var(--md-error-container)" }}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {intact ? (
            <ShieldCheck size={28} style={{ color: "var(--md-on-primary-container)" }} aria-hidden />
          ) : (
            <ShieldAlert size={28} style={{ color: "var(--md-error)" }} aria-hidden />
          )}
          <div>
            <div className="headline-small" style={{ color: intact ? "var(--md-on-primary-container)" : "var(--md-on-error-container)" }}>
              {intact ? t.auditPage.intact : fill(t.auditPage.broken, { id: String(status.first_broken_id) })}
            </div>
            <div className="label-small">{fill(intact ? t.auditPage.intactNote : t.auditPage.records, { n: num(Number(status.total), lang) })}</div>
          </div>
        </div>
        <Link href="/audit" className="btn btn-filled btn-sm" prefetch={false}>
          {t.auditPage.recheck}
        </Link>
      </div>
    </div>
  );
}

async function Entries({ lang }: { lang: Lang }) {
  const t = dict(lang);
  const [{ role }, entries] = await Promise.all([getSession(), getAuditEntries({ limit: 100 })]);
  // Hash values are for officers and technical checks; the public sees the verified status above.
  const showHash = role === "officer";
  return (
    <section className="card">
      {entries.length === 0 ? (
        <p className="body-medium">{t.auditPage.empty}</p>
      ) : (
        <div className="table-wrap">
          <table className="md-table" style={{ fontSize: "0.8rem" }}>
            <thead>
              <tr>
                <th>{t.auditPage.colId}</th>
                <th>{t.auditPage.colTime}</th>
                <th>{t.auditPage.colActor}</th>
                <th>{t.auditPage.colAction}</th>
                <th>{t.auditPage.colTarget}</th>
                {showHash && <th>{t.auditPage.colHash}</th>}
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id}>
                  <td className="mono">#{String(e.id).padStart(4, "0")}</td>
                  <td style={{ whiteSpace: "nowrap" }}>{dateTime(e.created_at, lang)}</td>
                  <td>
                    <span className={`tag ${ROLE_TONE[e.actor_role] ?? ""}`}>{e.actor_name}</span>
                  </td>
                  <td className="mono">{e.action}</td>
                  <td className="mono">
                    {e.entity}
                    {e.entity_id ? `-${e.entity_id}` : ""}
                  </td>
                  {showHash && (
                    <td className="mono" title={e.hash}>
                      {e.hash.slice(0, 10)}…
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="label-small" style={{ marginTop: 10 }}>
        {t.auditPage.redacted}
      </p>
    </section>
  );
}
