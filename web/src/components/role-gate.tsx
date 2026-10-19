import { RoleLink } from "@/components/role-link";
import { dict, fill, type Lang } from "@/lib/i18n";
import type { Role } from "@/lib/roles";

/** Shown when a role screen is opened with another role selected (no login: one click switches). */
export function RoleGate({ role, lang }: { role: Role; lang: Lang }) {
  const t = dict(lang);
  return (
    <div className="card card-low" style={{ maxWidth: 560 }}>
      <h1 className="headline-small">{t.roles[role]}</h1>
      <p className="body-medium" style={{ margin: "6px 0 16px" }}>
        {t.roleBlurb[role]}
      </p>
      <RoleLink role={role} className="btn btn-filled">
        {fill(t.common.continueAs, { role: t.roles[role] })}
      </RoleLink>
    </div>
  );
}
