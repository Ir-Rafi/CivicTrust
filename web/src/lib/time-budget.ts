/**
 * Wall-clock budget for a request with several slow steps (AI calls), so each step gets only
 * the time that is left and the request finishes before the platform's limit cuts it off.
 */
export type TimeBudget = {
  elapsed: () => number;
  remaining: () => number;
  /** Timeout for the next step: its own cap, but never beyond the budget minus a reserve kept for later steps. */
  timeoutFor: (capMs: number, reserveMs?: number) => number;
};

export function createBudget(totalMs: number, now: () => number = Date.now): TimeBudget {
  const start = now();
  const remaining = () => Math.max(0, totalMs - (now() - start));
  return {
    elapsed: () => now() - start,
    remaining,
    timeoutFor: (capMs, reserveMs = 0) => Math.max(0, Math.min(capMs, remaining() - reserveMs)),
  };
}
