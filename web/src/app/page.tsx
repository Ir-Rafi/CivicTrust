import { ArrowRight } from "lucide-react";
import { Suspense } from "react";
import { switchRole } from "@/app/actions/session";
import { getPaymentSummary } from "@/lib/dashboard";
import { taka } from "@/lib/format";
import { dict, num, type Lang } from "@/lib/i18n";
import { ROLES } from "@/lib/roles";
import { getSession } from "@/lib/session";

export default function Home() {
  return (
    <Suspense fallback={<div style={{ height: 480 }} />}>
      <HomeView />
    </Suspense>
  );
}

async function HomeView() {
  const { lang } = await getSession();
  const t = dict(lang);
  return (
    <>
      <section className="hero-banner" style={{ marginTop: 8 }}>
        <div>
          <div className="hero-chip">
            <span className="hero-chip-dot" />
            <span>{t.home.chip}</span>
          </div>
          <h1 className="display-large" style={{ marginBottom: 24 }}>
            {t.home.titleA} <span style={{ color: "var(--md-primary)" }}>{t.home.titleB}</span>
          </h1>
          <p className="body-medium" style={{ fontSize: "1.2rem", lineHeight: 1.65, maxWidth: 560, marginBottom: 24 }}>
            {t.home.desc}
          </p>
          <div className="flex flex-wrap gap-4">
            <form action={switchRole}>
              <input type="hidden" name="role" value="citizen" />
              <button type="submit" className="btn btn-filled">
                {t.home.ctaReport} <ArrowRight size={18} aria-hidden />
              </button>
            </form>
            <form action={switchRole}>
              <input type="hidden" name="role" value="public" />
              <button type="submit" className="btn btn-outlined">
                {t.home.ctaPublic}
              </button>
            </form>
          </div>
        </div>
        <div className="hero-shapes" aria-hidden>
          <div className="shape-square-purple" />
          <div className="shape-square-lavender" />
          <div className="shape-circle-rose" />
        </div>
      </section>

      <Suspense fallback={<div className="hero-metric-card" style={{ maxWidth: 560, height: 210, marginBottom: 36 }} />}>
        <PaymentGateCard lang={lang} />
      </Suspense>

      <section>
        <h2 className="label-small" style={{ fontWeight: 600, marginBottom: 12 }}>
          {t.chooseRole}
        </h2>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ROLES.map((r) => (
            <li key={r}>
              <form action={switchRole} className="h-full">
                <input type="hidden" name="role" value={r} />
                <button type="submit" className="card card-low card-link h-full w-full text-left" style={{ cursor: "pointer" }}>
                  <span className="title-medium" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    {t.roles[r]}
                    <ArrowRight size={16} aria-hidden style={{ color: "var(--md-primary)" }} />
                  </span>
                  <span className="body-medium" style={{ display: "block", marginTop: 6 }}>
                    {t.roleBlurb[r]}
                  </span>
                </button>
              </form>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

async function PaymentGateCard({ lang }: { lang: Lang }) {
  const t = dict(lang);
  const s = await getPaymentSummary();
  return (
    <div className="hero-metric-card" style={{ maxWidth: 560, marginBottom: 36 }}>
      <div className="label-small" style={{ textTransform: "uppercase" }}>
        {t.home.gateLabel}
      </div>
      <div className="metric-value">{taka(s.withheld, lang)}</div>
      <div className="body-medium" style={{ fontSize: "0.8rem" }}>
        {t.home.gateNote}
      </div>
      <div className="stat-row">
        <div>
          <div className="stat-figure" style={{ color: "var(--md-success)" }}>
            {num(s.verified, lang)}
          </div>
          <div className="label-small">{t.home.verified}</div>
        </div>
        <div>
          <div className="stat-figure" style={{ color: "var(--md-error)" }}>
            {num(s.rejectedProofs, lang)}
          </div>
          <div className="label-small">{t.home.rejected}</div>
        </div>
        <div>
          <div className="stat-figure">{taka(s.released, lang)}</div>
          <div className="label-small">{t.home.released}</div>
        </div>
      </div>
    </div>
  );
}
