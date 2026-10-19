"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ComponentProps } from "react";
import { COOKIE_MAX_AGE, ROLE_COOKIE, ROLE_HOME, type Role } from "@/lib/roles";

/**
 * Opens a role's screen as that role. The cookie is set in the browser, not in a Server Action:
 * a cookie set in a Server Action clears the whole client router cache, so every later
 * navigation refetched from scratch. The server still reads the role from the same cookie.
 */
export function RoleLink({ role, onClick, ...props }: { role: Role } & Omit<ComponentProps<typeof Link>, "href">) {
  const router = useRouter();
  const pathname = usePathname();
  const href = ROLE_HOME[role];
  return (
    <Link
      {...props}
      href={href}
      onClick={(e) => {
        onClick?.(e);
        document.cookie = `${ROLE_COOKIE}=${role}; path=/; max-age=${COOKIE_MAX_AGE}; samesite=lax`;
        // Already on that screen (e.g. its role gate): re-render it with the new role.
        if (pathname === href) {
          e.preventDefault();
          router.refresh();
        }
      }}
    />
  );
}
