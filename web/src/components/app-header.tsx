import Link from "next/link";
import { switchRole } from "@/app/actions/session";
import { LanguageToggle } from "@/components/language-toggle";
import { dict } from "@/lib/i18n";
import { ROLES } from "@/lib/roles";
import { getSession } from "@/lib/session";

export async function AppHeader() {
  const { role, lang } = await getSession();
  const t = dict(lang);
  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          {t.appName}
        </Link>
        <nav aria-label={t.switchRole} className="flex flex-1 flex-wrap gap-1">
          {ROLES.map((r) => (
            <form key={r} action={switchRole}>
              <input type="hidden" name="role" value={r} />
              <button
                type="submit"
                aria-current={r === role ? "page" : undefined}
                className="rounded-md px-2.5 py-1.5 text-sm text-muted hover:bg-surface-2 aria-[current=page]:bg-accent aria-[current=page]:text-accent-fg"
              >
                {t.roles[r]}
              </button>
            </form>
          ))}
        </nav>
        <LanguageToggle lang={lang} label={t.language} />
      </div>
    </header>
  );
}

export function AppHeaderFallback() {
  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex h-[57px] max-w-6xl items-center px-4 text-lg font-semibold">CivicTrust</div>
    </header>
  );
}
