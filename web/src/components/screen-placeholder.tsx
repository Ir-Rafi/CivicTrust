import { dict, type Dict } from "@/lib/i18n";
import { getSession } from "@/lib/session";

/** Temporary body for screens scheduled later in the build plan. */
export async function ScreenPlaceholder({ screen }: { screen: keyof Dict["screens"] }) {
  const { lang } = await getSession();
  const t = dict(lang);
  return (
    <section className="rounded-lg border border-dashed border-line p-6">
      <h1 className="text-xl font-semibold">{t.screens[screen]}</h1>
      <p className="mt-2 text-muted">{t.comingSoon}</p>
    </section>
  );
}
