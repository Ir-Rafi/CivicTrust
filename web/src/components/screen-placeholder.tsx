import { dict } from "@/lib/i18n";
import { getSession } from "@/lib/session";

/** Temporary body for screens scheduled later in the build plan. */
export async function ScreenPlaceholder({ title, plannedFor }: { title: string; plannedFor: string }) {
  const { lang } = await getSession();
  return (
    <section className="rounded-lg border border-dashed border-line p-6">
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="mt-2 text-muted">
        {dict(lang).buildingNote} ({plannedFor})
      </p>
    </section>
  );
}
