import type { RepairProof, WorkOrderDetail } from "@/lib/dashboard";
import { dateTime, statusTone, taka } from "@/lib/format";
import { dict, num, type Lang } from "@/lib/i18n";

const STEP_KEYS = ["assigned", "proof", "verify", "citizen", "paid"] as const;

/** Where the job is: assigned → repair photo → AI verification → citizen check → payment. */
export function WorkOrderStepper({ order, citizenConfirmed, lang }: { order: WorkOrderDetail; citizenConfirmed?: boolean; lang: Lang }) {
  const t = dict(lang);
  let current = 1;
  let problem: number | null = null;
  if (order.status === "rejected") problem = 2;
  if (order.status === "submitted") current = 2;
  if (order.status === "approved") current = citizenConfirmed ? 4 : 3;
  if (order.payment_status === "released") current = 5;
  return (
    <ol className="stepper">
      {STEP_KEYS.map((k, i) => (
        <li key={k} className={i === problem ? "problem" : i < current ? "done" : i === current ? "current" : undefined}>
          {t.steps[k]}
        </li>
      ))}
    </ol>
  );
}

export function ProofChecks({ proof, lang }: { proof: RepairProof; lang: Lang }) {
  const t = dict(lang);
  const c = proof.checks ?? {};
  const mark = (ok: boolean | undefined) =>
    ok === undefined ? t.common.none : ok ? `✓ ${t.common.yes}` : `✗ ${t.common.no}`;
  const aiVal = (v: string | undefined) => (v === "yes" ? true : v === "no" ? false : undefined);
  const rows: [string, string, boolean | undefined][] = [
    [t.officer.distance, Number.isFinite(c.distance_m) ? `${num(Math.round(c.distance_m ?? 0), lang)} m` : t.common.none, c.distance_passed],
    [t.officer.fresh, mark(c.fresh), c.fresh],
    [t.officer.afterOrder, mark(c.after_work_order), c.after_work_order],
  ];
  if (c.ai) {
    rows.push([t.officer.sameSite, c.ai.same_location, aiVal(c.ai.same_location)]);
    rows.push([t.officer.resolved, c.ai.issue_resolved, aiVal(c.ai.issue_resolved)]);
    rows.push([t.officer.confidence, `${num(Math.round(c.ai.confidence * 100), lang)}%`, undefined]);
  }
  return (
    <ul className="factor-list">
      {rows.map(([label, value, ok]) => (
        <li key={label}>
          <span>{label}</span>
          <strong style={{ color: ok === false ? "var(--md-error)" : ok ? "var(--md-success)" : undefined }}>{value}</strong>
        </li>
      ))}
    </ul>
  );
}

export function PaymentLine({ order, lang }: { order: WorkOrderDetail; lang: Lang }) {
  const t = dict(lang);
  const color =
    order.payment_status === "released"
      ? "var(--md-success)"
      : order.payment_status === "eligible"
        ? "var(--md-primary)"
        : "var(--md-error)";
  return (
    <div>
      <div className="label-small">{t.common.payment}</div>
      <div style={{ fontSize: "1.25rem", fontWeight: 600, color }}>
        {t.payment[order.payment_status]} · {taka(order.agreed_cost, lang)}
      </div>
    </div>
  );
}

/** Summary of one work order: who, when, how much, which rule set the deadline, and the latest proof. */
export function WorkOrderSummary({ order, lang, showProof = true }: { order: WorkOrderDetail; lang: Lang; showProof?: boolean }) {
  const t = dict(lang);
  const proof = order.proofs[0];
  return (
    <div className="stack" style={{ gap: 10 }}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="title-medium">
          #WO-{order.id}
          {order.assignee_name ? ` · ${order.assignee_name}` : ""}
        </span>
        <span className={`tag ${statusTone(order.status)}`}>{t.workOrderStatus[order.status]}</span>
      </div>
      <div className="label-small">
        {t.common.deadline}: {dateTime(order.deadline, lang)}
        {order.overdue && <strong style={{ color: "var(--md-error)" }}> · {t.common.overdue}</strong>}
        {" · "}
        {t.common.cost}: {taka(order.agreed_cost, lang)}
      </div>
      {order.deadline_basis && (
        <div className="panel-outline" style={{ padding: 12 }}>
          <div className="eyebrow">{t.officer.policyCited}</div>
          <p className="body-medium" style={{ fontSize: "0.82rem" }} lang="en">
            {order.deadline_basis.title} — {order.deadline_basis.band}, {num(order.deadline_basis.hours, lang)} h
            <span className="label-small" style={{ display: "block" }}>
              {order.deadline_basis.source}
              {order.deadline_basis.similarity !== undefined &&
                ` · ${num(Math.round(order.deadline_basis.similarity * 100), lang)}% ${t.officer.similarity}`}
            </span>
          </p>
        </div>
      )}
      {showProof && proof && (
        <div className="panel-outline" style={{ padding: 12 }}>
          <div className="flex flex-wrap items-center justify-between gap-2" style={{ marginBottom: 6 }}>
            <span className="eyebrow">{t.officer.latestProof}</span>
            <span className={`tag ${statusTone(proof.verdict)}`}>{t.verdict[proof.verdict]}</span>
          </div>
          {proof.verdict_reason_en && (
            <p className="body-medium" style={{ fontSize: "0.82rem", marginBottom: 6 }} lang="en">
              {proof.verdict_reason_en}
            </p>
          )}
          <ProofChecks proof={proof} lang={lang} />
          {proof.officer_decision && (
            <p className="label-small" style={{ marginTop: 6 }}>
              {t.officer.officerDecision}: <strong>{t.workOrderStatus[proof.officer_decision]}</strong>
              {proof.officer_reason ? ` — ${proof.officer_reason}` : ""}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
