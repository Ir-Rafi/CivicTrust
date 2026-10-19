import { ISSUE_TYPES, type IssueType } from "@/lib/ai/schemas";
import type { OrderFlag } from "@/lib/dashboard";
import type { OfficerQueueItem } from "@/lib/workflow";

export const FILTERS = ["open", "new", "critical", "action", "all"] as const;
export type Filter = (typeof FILTERS)[number];

export type QueueSelection = {
  filter: Filter;
  type?: IssueType;
  area?: string;
  selectedId: number | null;
};

const CLOSED = new Set(["fixed", "confirmed", "rejected"]);

/** Keep the queue's order while applying every selected filter to the loaded rows. */
export function applyQueueFilters<T extends Pick<OfficerQueueItem, "id" | "status" | "severity" | "issue_type" | "area_en">>(
  items: T[],
  selection: { filter: Filter; type?: IssueType; area?: string },
  flags: ReadonlyMap<number, OrderFlag>,
): T[] {
  return items.filter((item) => {
    if (selection.type && item.issue_type !== selection.type) return false;
    if (selection.area && item.area_en !== selection.area) return false;
    switch (selection.filter) {
      case "open":
        return !CLOSED.has(item.status) || flags.has(item.id);
      case "new":
        return item.status === "reported" || item.status === "verified";
      case "critical":
        return item.severity >= 8 && !CLOSED.has(item.status);
      case "action":
        return flags.has(item.id);
      default:
        return true;
    }
  });
}

/** Read the same validated selection on initial render and browser Back/Forward. */
export function readQueueSelection(params: Pick<URLSearchParams, "get">): QueueSelection {
  const filter = params.get("f");
  const type = params.get("type");
  const area = params.get("area")?.trim() || undefined;
  const rawId = params.get("issue");
  const id = rawId && /^\d+$/.test(rawId) ? Number(rawId) : NaN;
  return {
    filter: FILTERS.includes(filter as Filter) ? (filter as Filter) : "open",
    type: ISSUE_TYPES.includes(type as IssueType) ? (type as IssueType) : undefined,
    area,
    selectedId: Number.isSafeInteger(id) && id > 0 ? id : null,
  };
}

/** Build shareable queue URLs; null explicitly clears a filter or selected issue. */
export function officerQueueHref(
  selection: QueueSelection,
  next: { f?: Filter; type?: string | null; area?: string | null; issue?: number | null },
): string {
  const params = new URLSearchParams();
  const filter = next.f ?? selection.filter;
  const type = next.type === null ? undefined : (next.type ?? selection.type);
  const area = next.area === null ? undefined : (next.area ?? selection.area);
  const selectedId = next.issue === null ? null : (next.issue ?? selection.selectedId);
  if (filter !== "open") params.set("f", filter);
  if (type) params.set("type", type);
  if (area) params.set("area", area);
  if (selectedId) params.set("issue", String(selectedId));
  const query = params.toString();
  return query ? `/officer?${query}` : "/officer";
}
