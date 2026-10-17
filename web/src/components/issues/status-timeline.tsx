import { Check } from "lucide-react";
import type { Dict } from "@/lib/i18n";
import type { IssueStatus } from "@/lib/issues";

const FLOW: IssueStatus[] = ["reported", "verified", "assigned", "in_progress", "fixed", "confirmed"];

export function StatusTimeline({ status, t }: { status: IssueStatus; t: Dict["status"] }) {
  const current = status === "disputed" ? FLOW.indexOf("fixed") : FLOW.indexOf(status);
  return (
    <ol className="flex flex-wrap gap-x-1 gap-y-2 text-xs">
      {FLOW.map((step, i) => {
        const done = i <= current;
        return (
          <li key={step} className="flex items-center gap-1">
            <span
              aria-current={i === current ? "step" : undefined}
              className={`inline-flex items-center gap-1 rounded-full px-2 py-1 ${
                done ? "bg-accent text-accent-fg" : "bg-surface-2 text-muted"
              } aria-[current=step]:ring-2 aria-[current=step]:ring-accent/40`}
            >
              {done && <Check size={12} aria-hidden />}
              {t[step]}
            </span>
            {i < FLOW.length - 1 && <span className="text-muted" aria-hidden>›</span>}
          </li>
        );
      })}
      {status === "disputed" && <li className="rounded-full bg-danger/10 px-2 py-1 text-danger">{t.disputed}</li>}
    </ol>
  );
}
