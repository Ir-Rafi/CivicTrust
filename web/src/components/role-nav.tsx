"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { RoleLink } from "@/components/role-link";
import { ROLE_HOME, ROLES, type Role } from "@/lib/roles";

/** Role tabs: each sets the role cookie (no login, by design) and opens that role's screen.
 *  On narrow screens the tabs collapse into a hamburger dropdown (GitHub-style). */
export function RoleNav({
  labels,
  auditLabel,
  navLabel,
  menuLabel,
}: {
  labels: Record<Role, string>;
  auditLabel: string;
  navLabel: string;
  menuLabel: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const shellRef = useRef<HTMLDivElement>(null);

  // Close on outside tap or Escape. (Tapping a menu item closes it via each link's onClick.)
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (shellRef.current && !shellRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className="nav-shell" ref={shellRef}>
      <button
        type="button"
        className="nav-menu-toggle"
        aria-label={menuLabel}
        aria-expanded={open}
        aria-controls="role-nav-menu"
        onClick={() => setOpen((v) => !v)}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          {open ? (
            <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          ) : (
            <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          )}
        </svg>
      </button>
      <nav id="role-nav-menu" className="nav-pill-group" data-open={open ? "" : undefined} aria-label={navLabel}>
        {ROLES.map((r) => (
          <RoleLink
            key={r}
            role={r}
            className="nav-pill"
            aria-current={pathname.startsWith(ROLE_HOME[r]) ? "page" : undefined}
            onClick={() => setOpen(false)}
          >
            {labels[r]}
          </RoleLink>
        ))}
        <Link
          href="/audit"
          className="nav-pill"
          aria-current={pathname.startsWith("/audit") ? "page" : undefined}
          onClick={() => setOpen(false)}
        >
          {auditLabel}
        </Link>
      </nav>
    </div>
  );
}
