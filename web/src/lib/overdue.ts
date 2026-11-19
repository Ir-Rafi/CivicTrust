// When a work order is overdue, and which overdue orders the daily check still has to record.
// Pure rules shared by the dashboard, the officer queue and the scheduled check.

/** Statuses that end a job: an approved repair, or an order the officer cancelled. */
const FINISHED = new Set(["approved", "cancelled"]);

/** Past its deadline without an approved repair. */
export function isOverdue(order: { status: string; deadline: string }, now: number): boolean {
  return !FINISHED.has(order.status) && new Date(order.deadline).getTime() < now;
}

/** Whole hours since the deadline (0 if it hasn't passed). */
export function hoursLate(deadline: string, now: number): number {
  return Math.max(0, Math.floor((now - new Date(deadline).getTime()) / 3_600_000));
}

/** Overdue orders that have no overdue entry in the audit log yet; each order is recorded once. */
export function newlyOverdue<T extends { id: number; status: string; deadline: string }>(orders: T[], alreadyRecorded: ReadonlySet<number>, now: number): T[] {
  return orders.filter((o) => isOverdue(o, now) && !alreadyRecorded.has(o.id));
}
