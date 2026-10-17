"use client";

import { usePathname } from "next/navigation";
import { setLanguage } from "@/app/actions/session";
import type { Lang } from "@/lib/i18n";

export function LanguageToggle({ lang, label }: { lang: Lang; label: string }) {
  const pathname = usePathname();
  return (
    <form action={setLanguage}>
      <input type="hidden" name="lang" value={lang === "bn" ? "en" : "bn"} />
      <input type="hidden" name="back" value={pathname} />
      <button
        type="submit"
        className="rounded-md border border-line px-3 py-1.5 text-sm font-medium hover:bg-surface-2"
      >
        {label}
      </button>
    </form>
  );
}
