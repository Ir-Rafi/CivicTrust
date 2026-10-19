import Image from "next/image";
import Link from "next/link";
import { LanguageToggle } from "@/components/language-toggle";
import { RoleNav } from "@/components/role-nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { dict } from "@/lib/i18n";
import { getSession } from "@/lib/session";

function Brand({ name }: { name: string }) {
  return (
    <Link href="/" className="brand-group">
      <Image src="/brand/civictrust-mark.png" alt="" width={40} height={40} priority className="brand-logo" />
      <span className="brand-name">{name}</span>
    </Link>
  );
}

export async function AppHeader() {
  const { lang } = await getSession();
  const t = dict(lang);
  return (
    <header className="app-bar">
      <div className="container app-bar-content">
        <Brand name="CivicTrust" />
        <RoleNav labels={t.roles} auditLabel={t.auditTab} navLabel={t.switchRole} menuLabel={t.menu} />
        <div className="header-actions">
          <ThemeToggle label={t.theme} />
          <LanguageToggle lang={lang} label={t.language} />
        </div>
      </div>
    </header>
  );
}

export function AppHeaderFallback() {
  return (
    <header className="app-bar">
      <div className="container app-bar-content">
        <Brand name="CivicTrust" />
      </div>
    </header>
  );
}

export async function AppFooter() {
  const { lang } = await getSession();
  const t = dict(lang);
  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div>
          <div style={{ fontWeight: 600, fontSize: "1.1rem", color: "var(--md-primary)", marginBottom: 6 }}>CivicTrust</div>
          <p className="label-small">{t.footer.about}</p>
        </div>
        <div>
          <div className="label-small" style={{ fontWeight: 600, marginBottom: 6 }}>
            {t.footer.pages}
          </div>
          <ul style={{ listStyle: "none", fontSize: "0.8rem", lineHeight: 2 }}>
            <li>
              <Link href="/architecture">{t.nav.architecture}</Link>
            </li>
            <li>
              <Link href="/data">{t.nav.data}</Link>
            </li>
            <li>
              <Link href="/security">{t.nav.security}</Link>
            </li>
            <li>
              <Link href="/audit">{t.nav.audit}</Link>
            </li>
          </ul>
        </div>
        <div>
          <div className="label-small" style={{ fontWeight: 600, marginBottom: 6 }}>
            {t.footer.attribution}
          </div>
          <p className="label-small">{t.footer.osm}</p>
        </div>
      </div>
    </footer>
  );
}
