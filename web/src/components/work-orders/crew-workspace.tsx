import Link from "next/link";
import { Suspense } from "react";
import { getContractorWorkOrders, getNgoWorkOrders } from "@/app/contractor/actions";
import { SeverityScore } from "@/components/issues/severity-breakdown";
import { RepairUpload } from "@/components/work-orders/repair-upload";
import { PaymentLine, ProofChecks, WorkOrderStepper, WorkOrderSummary } from "@/components/work-orders/work-order-card";
import type { IssueType } from "@/lib/ai/schemas";
import { getWorkSite, listAssignees, type PaymentStatus, type WorkOrderStatus } from "@/lib/dashboard";
import { dateTime, statusTone, taka } from "@/lib/format";
import { googleMapsUrl } from "@/lib/geo";
import { dict, type Lang } from "@/lib/i18n";

type Kind = "contractor" | "ngo";

type OrderRow = {
  id: number;
  agreed_cost: number | null;
  deadline: string;
  status: WorkOrderStatus;
  payment_status: PaymentStatus;
  issues: { issue_type: IssueType; severity: number; road_name: string | null } | null;
};

const SUBMITTABLE: WorkOrderStatus[] = ["open", "in_progress", "rejected"];

/** Work orders for one contractor or NGO, and the repair-proof upload for the selected one. */
export async function CrewWorkspace({
  kind,
  lang,
  query,
}: {
  kind: Kind;
  lang: Lang;
  query: Record<string, string | string[] | undefined>;
}) {
  const t = dict(lang);
  const base = kind === "contractor" ? "/contractor" : "/ngo";
  const assignees = await listAssignees();
  const list = kind === "contractor" ? assignees.contractors : assignees.ngos;
  if (list.length === 0) {
    return (
      <section className="card">
        <h1 className="headline-small">{t.repair.title}</h1>
        <p className="body-medium" style={{ marginTop: 6 }}>
          {t.officer.noAssignees}
        </p>
      </section>
    );
  }
  const who = list.find((a) => a.id === Number(query.who)) ?? list[0];
  const orders = (
    kind === "contractor" ? await getContractorWorkOrders(who.id) : await getNgoWorkOrders(who.id)
  ) as unknown as OrderRow[];
  const visible = orders.filter((o) => o.status !== "cancelled");
  const selectedId = Number(query.wo) || visible.find((o) => SUBMITTABLE.includes(o.status))?.id || visible[0]?.id || null;
  const link = (wo: number) => `${base}?who=${who.id}&wo=${wo}`;

  return (
    <div className="asymmetric-grid">
      <section className="card">
        <div className="card-head" style={{ flexWrap: "wrap" }}>
          <h1 className="headline-small">{t.repair.title}</h1>
          {list.length > 1 && (
            <form action={base} className="flex items-end gap-2">
              <div className="input-field-group" style={{ marginBottom: 0 }}>
                <label className="input-field-label" htmlFor="who">
                  {t.repair.pickAssignee}
                </label>
                <select id="who" name="who" defaultValue={who.id} className="input-filled" style={{ height: 40 }}>
                  {list.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
              <button type="submit" className="btn btn-tonal btn-sm" style={{ height: 40 }}>
                {t.repair.switch}
              </button>
            </form>
          )}
        </div>
        {list.length === 1 && (
          <p className="label-small" style={{ marginTop: -8, marginBottom: 12 }}>
            {t.repair.pickAssignee}: {who.name}
          </p>
        )}

        {visible.length === 0 ? (
          <p className="body-medium">{t.repair.empty}</p>
        ) : (
          <ul className="stack" style={{ gap: 10 }}>
            {visible.map((o) => (
              <li key={o.id}>
                <Link
                  href={link(o.id)}
                  scroll={false}
                  className={`panel card-link ${o.id === selectedId ? "selected-card" : ""}`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="title-medium">
                      #WO-{o.id} · {o.issues ? t.issueType[o.issues.issue_type] : t.common.issue}
                    </span>
                    {o.issues && <SeverityScore score={o.issues.severity} lang={lang} />}
                  </div>
                  <p className="label-small" style={{ marginTop: 2 }}>
                    {o.issues?.road_name ?? t.common.noRoad} · {t.common.deadline}: {dateTime(o.deadline, lang)} · {taka(o.agreed_cost, lang)}
                  </p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1" style={{ marginTop: 8 }}>
                    <span className={`tag ${statusTone(o.status)}`}>{t.workOrderStatus[o.status]}</span>
                    <span className={`tag ${statusTone(o.payment_status === "withheld" ? "rejected" : o.payment_status)}`}>
                      {t.common.payment}: {t.payment[o.payment_status]}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card card-high">
        {selectedId ? (
          <Suspense key={selectedId} fallback={<p className="label-small">{t.common.loading}</p>}>
            <WorkSitePanel workOrderId={selectedId} kind={kind} assigneeId={who.id} lang={lang} />
          </Suspense>
        ) : (
          <p className="body-medium">{t.repair.empty}</p>
        )}
      </section>
    </div>
  );
}

async function WorkSitePanel({ workOrderId, kind, assigneeId, lang }: { workOrderId: number; kind: Kind; assigneeId: number; lang: Lang }) {
  const t = dict(lang);
  const site = await getWorkSite(workOrderId, kind === "contractor" ? { contractorId: assigneeId } : { ngoId: assigneeId });
  if (!site) return <p className="body-medium">{t.repair.empty}</p>;
  const { order, issue } = site;
  const latest = order.proofs[0];

  return (
    <div className="stack">
      <div>
        <div className="eyebrow">
          #WO-{order.id} · #CT-{issue.id}
        </div>
        <h2 className="headline-small" style={{ marginTop: 4 }}>
          {t.issueType[issue.issue_type]} · {issue.road_name ?? t.common.noRoad}
        </h2>
        <a href={googleMapsUrl(issue.lat, issue.lng)} target="_blank" rel="noopener noreferrer" className="text-link" style={{ fontSize: "0.85rem" }}>
          {t.common.openInMaps} ↗
        </a>
      </div>
      <WorkOrderStepper order={order} citizenConfirmed={issue.status === "confirmed"} lang={lang} />

      <div className="photo-pair">
        <figure>
          {site.beforeUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- signed URL
            <img src={site.beforeUrl} alt="" className="photo" style={{ aspectRatio: "4 / 3" }} />
          )}
          <figcaption className="label-small">{t.common.before}</figcaption>
        </figure>
        <figure>
          {latest?.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- signed URL
            <img src={latest.photoUrl} alt="" className="photo" style={{ aspectRatio: "4 / 3" }} />
          ) : (
            <div className="photo" style={{ aspectRatio: "4 / 3" }} />
          )}
          <figcaption className="label-small">{t.common.after}</figcaption>
        </figure>
      </div>

      <div className="panel">
        <WorkOrderSummary order={order} lang={lang} />
      </div>

      <div className="panel">
        <PaymentLine order={order} lang={lang} />
      </div>

      <div className="panel">
        {SUBMITTABLE.includes(order.status) ? (
          <RepairUpload workOrderId={order.id} site={{ lat: issue.lat, lng: issue.lng }} t={{ repair: t.repair, verdict: t.verdict, errors: t.errors }} />
        ) : (
          <p className="body-medium">{order.status === "submitted" ? t.repair.waiting : t.repair.noLonger}</p>
        )}
      </div>

      {order.proofs.length > 1 && (
        <details className="panel">
          <summary className="title-medium" style={{ cursor: "pointer" }}>
            {t.repair.history} ({order.proofs.length - 1})
          </summary>
          <ul className="stack" style={{ gap: 12, marginTop: 10 }}>
            {order.proofs.slice(1).map((p) => (
              <li key={p.id} className="panel-outline" style={{ padding: 12 }}>
                <div className="flex items-center justify-between gap-2" style={{ marginBottom: 6 }}>
                  <span className="label-small">{dateTime(p.created_at, lang)}</span>
                  <span className={`tag ${statusTone(p.verdict)}`}>{t.verdict[p.verdict]}</span>
                </div>
                {p.verdict_reason_en && (
                  <p className="body-medium" style={{ fontSize: "0.82rem", marginBottom: 6 }} lang="en">
                    {p.verdict_reason_en}
                  </p>
                )}
                <ProofChecks proof={p} lang={lang} />
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
