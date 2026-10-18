"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { switchRole } from "@/app/actions/session";
import { ROLE_HOME, ROLES, type Role } from "@/lib/roles";

/** Role tabs: each sets the role cookie (no login, by design) and opens that role's screen. */
export function RoleNav({ labels, auditLabel, navLabel }: { labels: Record<Role, string>; auditLabel: string; navLabel: string }) {
  const pathname = usePathname();
  return (
    <nav className="nav-pill-group" aria-label={navLabel}>
      {ROLES.map((r) => (
        <form key={r} action={switchRole}>
          <input type="hidden" name="role" value={r} />
          <button
            type="submit"
            className="nav-pill"
            aria-current={pathname.startsWith(ROLE_HOME[r]) ? "page" : undefined}
          >
            {labels[r]}
          </button>
        </form>
      ))}
      <Link href="/audit" className="nav-pill" aria-current={pathname.startsWith("/audit") ? "page" : undefined}>
        {auditLabel}
      </Link>
    </nav>
  );
}
