// Visibility of /docs, set in the deployment's environment rather than an in-app admin panel:
// the prototype has no login, so anyone could reach an admin page. Only people with access to the
// Vercel project can change these.
//   DOCS_ENABLED  "false", "0" or "off" hides the page; anything else (or unset) shows it
//   DOCS_FROM     first moment it is visible, e.g. 2026-11-01 or 2026-11-01T09:00
//   DOCS_UNTIL    last moment it is visible; a date alone means the end of that day
// Times without an offset are Dhaka time (+06:00). An unparseable value is ignored.

export type DocsAccess =
  | { open: true; until: Date | null }
  | { open: false; reason: "disabled" | "not_yet" | "ended"; from: Date | null; until: Date | null };

const DHAKA = "+06:00";

/** `YYYY-MM-DD` or `YYYY-MM-DDTHH:mm[:ss]`, optionally with an offset; null if invalid. */
export function parseDocsTime(value: string | undefined, endOfDay: boolean): Date | null {
  const v = value?.trim();
  if (!v) return null;
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(v);
  const dateTime = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(Z|[+-]\d{2}:\d{2})?$/.test(v);
  if (!dateOnly && !dateTime) return null;
  // Reject dates that don't exist instead of letting them roll over (2026-02-30 → 2 Mar).
  const [y, m, day] = v.slice(0, 10).split("-").map(Number);
  if (new Date(Date.UTC(y, m - 1, day)).getUTCDate() !== day) return null;
  const iso = dateOnly ? `${v}T${endOfDay ? "23:59:59" : "00:00:00"}${DHAKA}` : /(Z|[+-]\d{2}:\d{2})$/.test(v) ? v : `${v}${DHAKA}`;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Access for the current request, from the deployment's environment. */
export function currentDocsAccess(): DocsAccess {
  const { DOCS_ENABLED, DOCS_FROM, DOCS_UNTIL } = process.env;
  return docsAccess({ DOCS_ENABLED, DOCS_FROM, DOCS_UNTIL }, Date.now());
}

export function docsAccess(env: { DOCS_ENABLED?: string; DOCS_FROM?: string; DOCS_UNTIL?: string }, now: number): DocsAccess {
  const from = parseDocsTime(env.DOCS_FROM, false);
  const until = parseDocsTime(env.DOCS_UNTIL, true);
  if (/^(false|0|off|no)$/i.test(env.DOCS_ENABLED?.trim() ?? "")) return { open: false, reason: "disabled", from, until };
  if (from && now < from.getTime()) return { open: false, reason: "not_yet", from, until };
  if (until && now > until.getTime()) return { open: false, reason: "ended", from, until };
  return { open: true, until };
}
