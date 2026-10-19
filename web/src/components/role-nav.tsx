"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { RoleLink } from "@/components/role-link";
import { ROLE_HOME, ROLES, type Role } from "@/lib/roles";

/** Role tabs: each sets the role cookie (no login, by design) and opens that role's screen. */
export function RoleNav({ labels, auditLabel, navLabel }: { labels: Record<Role, string>; auditLabel: string; navLabel: string }) {
  const pathname = usePathname();
  return (
    <nav className="nav-pill-group" aria-label={navLabel}>
      {ROLES.map((r) => (
        <RoleLink
          key={r}
          role={r}
          className="nav-pill"
          aria-current={pathname.startsWith(ROLE_HOME[r]) ? "page" : undefined}
        >
          {labels[r]}
        </RoleLink>
      ))}
      <Link href="/audit" className="nav-pill" aria-current={pathname.startsWith("/audit") ? "page" : undefined}>
        {auditLabel}
      </Link>
    </nav>
  );
}
