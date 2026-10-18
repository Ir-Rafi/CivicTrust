"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { uiCorrectIssue, uiCreateWorkOrder, uiReleasePayment, uiReviewRepair, type UiResult } from "@/app/actions/ui";
import { ISSUE_TYPES, VISUAL_CLASSES, type IssueType, type VisualClass } from "@/lib/ai/schemas";
import type { Assignee } from "@/lib/dashboard";
import type { Dict } from "@/lib/i18n";

type T = Pick<Dict, "officer" | "issueType" | "visualClass" | "common">;

/** Runs an action, shows its error, and refreshes the server-rendered page on success. */
function useAction() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  function run(fn: () => Promise<UiResult<unknown>>, onDone?: () => void) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) return setError(res.error);
      onDone?.();
      router.refresh();
    });
  }
  return { pending, error, setError, run };
}

function ErrorNote({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <p role="alert" className="notice error" style={{ marginBottom: 12 }}>
      {error}
    </p>
  );
}

export function OverrideForm({
  issueId,
  current,
  t,
}: {
  issueId: number;
  current: { issueType: IssueType; visualClass: VisualClass; severity: number };
  t: T;
}) {
  const { pending, error, setError, run } = useAction();
  const [issueType, setIssueType] = useState("");
  const [visualClass, setVisualClass] = useState("");
  const [severity, setSeverity] = useState("");
  const [reason, setReason] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!issueType && !visualClass && !severity) return setError(t.officer.overrideNeedField);
    if (reason.trim().length < 3) return setError(t.officer.overrideNeedReason);
    run(
      () =>
        uiCorrectIssue({
          issueId,
          reason: reason.trim(),
          issueType: (issueType || undefined) as IssueType | undefined,
          visualClass: (visualClass || undefined) as VisualClass | undefined,
          severity: severity ? Number(severity) : undefined,
        }),
      () => {
        setIssueType("");
        setVisualClass("");
        setSeverity("");
        setReason("");
      },
    );
  }

  return (
    <form onSubmit={submit}>
      <div className="field-grid">
        <div className="input-field-group">
          <label className="input-field-label" htmlFor="ov-type">
            {t.officer.overrideType}
          </label>
          <select id="ov-type" className="input-filled" value={issueType} onChange={(e) => setIssueType(e.target.value)}>
            <option value="">
              {t.officer.keepAi} ({t.issueType[current.issueType]})
            </option>
            {ISSUE_TYPES.filter((v) => v !== current.issueType).map((v) => (
              <option key={v} value={v}>
                {t.issueType[v]}
              </option>
            ))}
          </select>
        </div>
        <div className="input-field-group">
          <label className="input-field-label" htmlFor="ov-class">
            {t.officer.overrideClass}
          </label>
          <select id="ov-class" className="input-filled" value={visualClass} onChange={(e) => setVisualClass(e.target.value)}>
            <option value="">
              {t.officer.keepAi} ({t.visualClass[current.visualClass]})
            </option>
            {VISUAL_CLASSES.filter((v) => v !== current.visualClass).map((v) => (
              <option key={v} value={v}>
                {t.visualClass[v]}
              </option>
            ))}
          </select>
        </div>
        <div className="input-field-group">
          <label className="input-field-label" htmlFor="ov-score">
            {t.officer.overrideScore}
          </label>
          <select id="ov-score" className="input-filled" value={severity} onChange={(e) => setSeverity(e.target.value)}>
            <option value="">
              {t.officer.keepAi} ({current.severity})
            </option>
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="input-field-group">
        <label className="input-field-label" htmlFor="ov-reason">
          {t.officer.overrideReason}
        </label>
        <textarea
          id="ov-reason"
          className="input-filled"
          value={reason}
          maxLength={1000}
          placeholder={t.officer.overrideReasonPh}
          onChange={(e) => setReason(e.target.value)}
        />
      </div>
      <ErrorNote error={error} />
      <button type="submit" className="btn btn-outlined btn-sm" disabled={pending}>
        {t.officer.overrideSave}
      </button>
    </form>
  );
}

export function AssignForm({
  issueId,
  contractors,
  ngos,
  t,
}: {
  issueId: number;
  contractors: Assignee[];
  ngos: Assignee[];
  t: T;
}) {
  const { pending, error, setError, run } = useAction();
  const [type, setType] = useState<"contractor" | "ngo">(contractors.length ? "contractor" : "ngo");
  const list = type === "contractor" ? contractors : ngos;
  const [assignee, setAssignee] = useState("");
  const [cost, setCost] = useState("");

  if (!contractors.length && !ngos.length) return <p className="body-medium">{t.officer.noAssignees}</p>;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const id = Number(assignee || list[0]?.id);
    if (!id) return setError(t.officer.noAssignees);
    const agreedCost = cost.trim() ? Number(cost.replace(/[,\s৳]/g, "")) : undefined;
    if (agreedCost !== undefined && !(agreedCost >= 0)) return setError(t.common.error);
    run(() =>
      uiCreateWorkOrder({
        issueId,
        assigneeType: type,
        contractorId: type === "contractor" ? id : undefined,
        ngoId: type === "ngo" ? id : undefined,
        agreedCost,
      }),
    );
  }

  return (
    <form onSubmit={submit}>
      <div className="field-grid">
        <div className="input-field-group">
          <label className="input-field-label" htmlFor="as-type">
            {t.officer.assignTo}
          </label>
          <select
            id="as-type"
            className="input-filled"
            value={type}
            onChange={(e) => {
              setType(e.target.value as "contractor" | "ngo");
              setAssignee("");
            }}
          >
            {contractors.length > 0 && <option value="contractor">{t.officer.contractor}</option>}
            {ngos.length > 0 && <option value="ngo">{t.officer.ngo}</option>}
          </select>
        </div>
        <div className="input-field-group">
          <label className="input-field-label" htmlFor="as-who">
            {type === "contractor" ? t.officer.contractor : t.officer.ngo}
          </label>
          <select id="as-who" className="input-filled" value={assignee} onChange={(e) => setAssignee(e.target.value)}>
            {list.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
        <div className="input-field-group">
          <label className="input-field-label" htmlFor="as-cost">
            {t.officer.assignCost}
          </label>
          <input
            id="as-cost"
            className="input-filled"
            inputMode="numeric"
            placeholder="35000"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
          />
        </div>
      </div>
      <ErrorNote error={error} />
      <button type="submit" className="btn btn-filled" disabled={pending}>
        {t.officer.assignSave}
      </button>
    </form>
  );
}

export function ReviewForm({ workOrderId, t }: { workOrderId: number; t: T }) {
  const { pending, error, setError, run } = useAction();
  const [reason, setReason] = useState("");

  function decide(decision: "approved" | "rejected") {
    if (reason.trim().length < 3) return setError(t.officer.overrideNeedReason);
    run(() => uiReviewRepair({ workOrderId, decision, reason: reason.trim() }), () => setReason(""));
  }

  return (
    <div>
      <div className="input-field-group">
        <label className="input-field-label" htmlFor={`rv-${workOrderId}`}>
          {t.officer.reviewReason}
        </label>
        <textarea
          id={`rv-${workOrderId}`}
          className="input-filled"
          value={reason}
          maxLength={1000}
          onChange={(e) => setReason(e.target.value)}
        />
      </div>
      <ErrorNote error={error} />
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-filled btn-sm" disabled={pending} onClick={() => decide("approved")}>
          {t.officer.approve}
        </button>
        <button type="button" className="btn btn-danger btn-sm" disabled={pending} onClick={() => decide("rejected")}>
          {t.officer.reject}
        </button>
      </div>
    </div>
  );
}

export function ReleaseButton({ workOrderId, label }: { workOrderId: number; label: string }) {
  const { pending, error, run } = useAction();
  return (
    <div>
      <ErrorNote error={error} />
      <button type="button" className="btn btn-filled btn-sm" disabled={pending} onClick={() => run(() => uiReleasePayment({ workOrderId }))}>
        {label}
      </button>
    </div>
  );
}
