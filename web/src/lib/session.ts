import "server-only";
import { cookies } from "next/headers";
import { isLang, type Lang } from "@/lib/i18n";
import { isRole, type Role } from "@/lib/roles";

export const ROLE_COOKIE = "ct_role";
export const LANG_COOKIE = "ct_lang";

export async function getSession(): Promise<{ role: Role | null; lang: Lang }> {
  const store = await cookies();
  const role = store.get(ROLE_COOKIE)?.value;
  const lang = store.get(LANG_COOKIE)?.value;
  return { role: isRole(role) ? role : null, lang: isLang(lang) ? lang : "bn" };
}
