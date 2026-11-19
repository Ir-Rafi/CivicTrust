"use client";

import { useState, useTransition } from "react";
import { uiAskAssistant } from "@/app/actions/ui";
import { checkQuestion, QUESTION_MAX } from "@/lib/agent/rules";
import type { Dict } from "@/lib/i18n";

type T = Dict["assistant"];

/** "Ask CivicTrust": the officer's question goes to a read-only agent; the answer shows what it checked. */
export function AssistantPanel({ t }: { t: T }) {
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<{ answer: string; tools: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function ask(text: string) {
    const checked = checkQuestion(text);
    if (!checked.ok) return setError(checked.error === "too_long" ? t.tooLong : t.tooShort);
    setError(null);
    startTransition(async () => {
      const res = await uiAskAssistant({ question: checked.question });
      if (!res.ok) {
        setResult(null);
        return setError(res.error);
      }
      setResult(res.data);
    });
  }

  const examples = [t.example1, t.example2, t.example3];
  return (
    <section className="card" aria-labelledby="assistant-title">
      <h2 id="assistant-title" className="title-medium">
        {t.title}
      </h2>
      <p className="label-small" style={{ maxWidth: 640, marginBottom: 12 }}>
        {t.intro}
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(question);
        }}
        style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
      >
        <input
          className="input-filled"
          style={{ flex: "1 1 260px", minWidth: 0 }}
          value={question}
          maxLength={QUESTION_MAX}
          placeholder={t.placeholder}
          aria-label={t.title}
          onChange={(e) => setQuestion(e.target.value)}
          disabled={pending}
        />
        <button type="submit" className="btn btn-filled" disabled={pending}>
          {pending ? t.asking : t.ask}
        </button>
      </form>
      <div className="label-small" style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", marginTop: 10 }}>
        <span>{t.examples}:</span>
        {examples.map((ex) => (
          <button
            key={ex}
            type="button"
            className="btn btn-tonal btn-sm"
            disabled={pending}
            onClick={() => {
              setQuestion(ex);
              ask(ex);
            }}
          >
            {ex}
          </button>
        ))}
      </div>
      {error && (
        <p role="alert" className="notice error" style={{ marginTop: 12 }}>
          {error}
        </p>
      )}
      {result && (
        <div className="panel" style={{ marginTop: 12 }} aria-live="polite">
          <p className="body-medium" style={{ whiteSpace: "pre-wrap" }}>
            {result.answer}
          </p>
          {result.tools.length > 0 && (
            <p className="label-small" style={{ marginTop: 8 }}>
              {t.checked}: {result.tools.map((name) => t.tools[name as keyof T["tools"]] ?? name).join(" · ")}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
