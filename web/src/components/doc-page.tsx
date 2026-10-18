import type { ReactNode } from "react";

export type DocSection = { heading: string; body: ReactNode };

/** Layout for the static system pages (/architecture, /data, /security). */
export function DocPage({ eyebrow, title, intro, sections }: { eyebrow: string; title: string; intro: string; sections: DocSection[] }) {
  return (
    <div className="stack" style={{ gap: 24 }}>
      <section className="hero-banner" style={{ marginTop: 8, marginBottom: 0, padding: "48px 48px", gridTemplateColumns: "1fr" }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 8 }}>
            {eyebrow}
          </div>
          <h1 className="headline-medium">{title}</h1>
          <p className="body-medium" style={{ maxWidth: 760, marginTop: 10, fontSize: "1rem" }}>
            {intro}
          </p>
        </div>
      </section>
      <div className="grid gap-6" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 420px), 1fr))" }}>
        {sections.map((s) => (
          <section key={s.heading} className="card prose-doc">
            <h2>{s.heading}</h2>
            {s.body}
          </section>
        ))}
      </div>
    </div>
  );
}

/** A left-to-right pipeline; wraps on small screens. */
export function Flow({ steps }: { steps: { title: string; detail: string }[] }) {
  return (
    <ol className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", listStyle: "none", padding: 0 }}>
      {steps.map((s, i) => (
        <li key={s.title} className="panel" style={{ position: "relative" }}>
          <div className="label-small" style={{ color: "var(--md-primary)", fontWeight: 600 }}>
            {s.title}
          </div>
          <p style={{ fontSize: "0.82rem", marginTop: 4, color: "var(--md-on-surface-variant)" }}>{s.detail}</p>
          {i < steps.length - 1 && (
            <span aria-hidden style={{ position: "absolute", right: -11, top: "50%", color: "var(--md-outline)", fontSize: "0.9rem" }}>
              →
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}
