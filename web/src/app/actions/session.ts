"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isLang } from "@/lib/i18n";
import { isRole, ROLE_HOME } from "@/lib/roles";
import { LANG_COOKIE, ROLE_COOKIE } from "@/lib/session";

const COOKIE_OPTS = { path: "/", sameSite: "lax" as const, maxAge: 60 * 60 * 24 * 30 };

export async function switchRole(formData: FormData) {
  const role = formData.get("role");
  if (!isRole(role)) throw new Error("Unknown role");
  (await cookies()).set(ROLE_COOKIE, role, COOKIE_OPTS);
  redirect(ROLE_HOME[role]);
}

export async function setLanguage(formData: FormData) {
  const lang = formData.get("lang");
  if (!isLang(lang)) throw new Error("Unknown language");
  (await cookies()).set(LANG_COOKIE, lang, COOKIE_OPTS);
  const back = formData.get("back");
  redirect(typeof back === "string" && back.startsWith("/") ? back : "/");
}
