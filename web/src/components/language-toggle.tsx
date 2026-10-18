"use client";

import { Globe } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import { setLanguage } from "@/app/actions/session";
import type { Lang } from "@/lib/i18n";

export function LanguageToggle({ lang, label }: { lang: Lang; label: string }) {
  const pathname = usePathname();
  const query = useSearchParams().toString();
  return (
    <form action={setLanguage}>
      <input type="hidden" name="lang" value={lang === "bn" ? "en" : "bn"} />
      <input type="hidden" name="back" value={query ? `${pathname}?${query}` : pathname} />
      <button type="submit" className="lang-pill-btn">
        <Globe size={16} aria-hidden />
        <span>{label}</span>
      </button>
    </form>
  );
}
