import { Suspense } from "react";
import { switchRole } from "@/app/actions/session";
import { dict } from "@/lib/i18n";
import { ROLES } from "@/lib/roles";
import { getSession } from "@/lib/session";

export default function Home() {
  return (
    <Suspense fallback={<div className="h-64" />}>
      <RolePicker />
    </Suspense>
  );
}

async function RolePicker() {
  const { lang } = await getSession();
  const t = dict(lang);
  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t.appName}</h1>
        <p className="mt-2 max-w-2xl text-muted">{t.tagline}</p>
      </section>
      <section>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted">{t.chooseRole}</h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ROLES.map((r) => (
            <li key={r}>
              <form action={switchRole} className="h-full">
                <input type="hidden" name="role" value={r} />
                <button
                  type="submit"
                  className="flex h-full w-full flex-col items-start rounded-lg border border-line bg-surface p-4 text-left hover:border-accent"
                >
                  <span className="font-semibold">{t.roles[r]}</span>
                  <span className="mt-1 text-sm text-muted">{t.roleBlurb[r]}</span>
                </button>
              </form>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
