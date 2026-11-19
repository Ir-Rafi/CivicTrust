import "server-only";
import { audit } from "@/lib/audit";
import { hoursLate, newlyOverdue } from "@/lib/overdue";
import { db } from "@/lib/supabase/server";

export const OVERDUE_ACTION = "work_order_overdue";

/** Work orders past their deadline without an approved repair, most overdue first. Read-only. */
export async function listOverdueOrders(now = Date.now()) {
  const { data, error } = await db()
    .from("work_orders")
    .select("id, issue_id, assignee_type, deadline, status")
    .not("status", "in", "(approved,cancelled)")
    .lt("deadline", new Date(now).toISOString())
    .order("deadline", { ascending: true });
  if (error) throw new Error(`overdue orders: ${error.message}`);
  return data ?? [];
}

/**
 * Scheduled workflow (daily, see vercel.json): find work orders past their deadline without an
 * approved repair and write one audit entry for each, so the delay appears in the public update
 * log and the hash-chained record. Safe to run again: orders already recorded are skipped.
 * A dry run reports what would be recorded and writes nothing (for testing schedulers).
 */
export async function runOverdueCheck({ now = Date.now(), dryRun = false }: { now?: number; dryRun?: boolean } = {}) {
  const checkedAt = new Date(now).toISOString();
  const overdue = await listOverdueOrders(now);
  if (overdue.length === 0) return { checked_at: checkedAt, dry_run: dryRun, overdue: 0, to_record: 0, newly_recorded: 0 };

  const { data: logged, error: logError } = await db()
    .from("audit_log")
    .select("entity_id")
    .eq("action", OVERDUE_ACTION)
    .eq("entity", "work_order")
    .in(
      "entity_id",
      overdue.map((o) => o.id),
    );
  if (logError) throw new Error(`overdue audit entries: ${logError.message}`);

  const fresh = newlyOverdue(overdue, new Set((logged ?? []).map((r) => r.entity_id as number)), now);
  if (dryRun) return { checked_at: checkedAt, dry_run: true, overdue: overdue.length, to_record: fresh.length, newly_recorded: 0 };
  // One at a time: the audit trigger chains each row to the previous one.
  for (const order of fresh) {
    await audit({
      actorRole: "system",
      actorName: "Daily overdue check",
      action: OVERDUE_ACTION,
      entity: "work_order",
      entityId: order.id,
      payload: { issue_id: order.issue_id, deadline: order.deadline, hours_late: hoursLate(order.deadline, now), assignee_type: order.assignee_type },
    });
  }
  return { checked_at: checkedAt, dry_run: false, overdue: overdue.length, to_record: fresh.length, newly_recorded: fresh.length };
}
