"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isLang } from "@/lib/i18n";
import { COOKIE_MAX_AGE } from "@/lib/roles";
import { LANG_COOKIE } from "@/lib/session";

// The role cookie is set in the browser (components/role-link.tsx) so switching roles keeps the
// client router cache. A language change re-renders every page, so clearing that cache is intended.
const COOKIE_OPTS = { path: "/", sameSite: "lax" as const, maxAge: COOKIE_MAX_AGE };

export async function setLanguage(formData: FormData) {
  const lang = formData.get("lang");
  if (!isLang(lang)) throw new Error("Unknown language");
  (await cookies()).set(LANG_COOKIE, lang, COOKIE_OPTS);
  const back = formData.get("back");
  redirect(typeof back === "string" && back.startsWith("/") ? back : "/");
}
