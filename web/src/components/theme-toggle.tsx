"use client";

import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";

/** Light/dark toggle. No login by design, so the choice is a plain cookie (ct_theme) set in the
 *  browser and applied before paint by the inline script in the root layout. When unset the theme
 *  follows the OS (prefers-color-scheme).
 *
 *  The current theme lives outside React (a DOM attribute + the OS media query), so it's read with
 *  useSyncExternalStore: the server snapshot is null (we can't know it until the browser), which
 *  keeps the first render identical on both sides. */
type Theme = "light" | "dark";
const THEME_COOKIE = "ct_theme";
const ONE_YEAR = 60 * 60 * 24 * 365;
const listeners = new Set<() => void>();

function subscribe(onChange: () => void) {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", onChange);
  listeners.add(onChange);
  return () => {
    mq.removeEventListener("change", onChange);
    listeners.delete(onChange);
  };
}

function getSnapshot(): Theme {
  const attr = document.documentElement.getAttribute("data-theme");
  if (attr === "light" || attr === "dark") return attr;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function setTheme(next: Theme) {
  document.documentElement.setAttribute("data-theme", next);
  document.cookie = `${THEME_COOKIE}=${next}; path=/; max-age=${ONE_YEAR}; samesite=lax`;
  for (const l of listeners) l();
}

export function ThemeToggle({ label }: { label: string }) {
  const theme = useSyncExternalStore<Theme | null>(subscribe, getSnapshot, () => null);
  const isDark = theme === "dark";
  return (
    <button
      type="button"
      className="theme-toggle-btn"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={label}
      aria-pressed={isDark}
    >
      {isDark ? <Sun size={18} aria-hidden /> : <Moon size={18} aria-hidden />}
    </button>
  );
}
