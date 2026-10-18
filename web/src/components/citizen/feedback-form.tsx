"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { uiSubmitFeedback } from "@/app/actions/ui";
import type { Dict } from "@/lib/i18n";

/** Citizen confirms or disputes an AI-approved repair (only offered while the issue is "fixed"). */
export function FeedbackForm({ issueId, t }: { issueId: number; t: Dict["citizen"] }) {
  const router = useRouter();
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function send(verdict: "confirmed" | "disputed") {
    setError(null);
    startTransition(async () => {
      const res = await uiSubmitFeedback({ issueId, verdict, comment: comment.trim() || undefined });
      if (!res.ok) return setError(res.error);
      router.refresh();
    });
  }

  return (
    <div className="panel">
      <div className="title-medium">{t.feedbackTitle}</div>
      <p className="body-medium" style={{ fontSize: "0.85rem", margin: "4px 0 12px" }}>
        {t.feedbackHelp}
      </p>
      <div className="input-field-group">
        <label className="input-field-label" htmlFor="fb-comment">
          {t.comment}
        </label>
        <textarea
          id="fb-comment"
          className="input-filled"
          value={comment}
          maxLength={1000}
          placeholder={t.commentPh}
          onChange={(e) => setComment(e.target.value)}
        />
      </div>
      {error && (
        <p role="alert" className="notice error" style={{ marginBottom: 12 }}>
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-filled btn-sm" disabled={pending} onClick={() => send("confirmed")}>
          {t.confirm}
        </button>
        <button type="button" className="btn btn-danger btn-sm" disabled={pending} onClick={() => send("disputed")}>
          {t.dispute}
        </button>
      </div>
    </div>
  );
}
