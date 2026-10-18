import type { Dict } from "@/lib/i18n";
import type { IssueStatus } from "@/lib/issues";

const FLOW: IssueStatus[] = ["reported", "verified", "assigned", "in_progress", "fixed", "confirmed"];

export function StatusTimeline({ status, t }: { status: IssueStatus; t: Dict["status"] }) {
  const current = status === "disputed" ? FLOW.indexOf("fixed") : FLOW.indexOf(status);
  return (
    <ol className="stepper">
      {FLOW.map((step, i) => (
        <li
          key={step}
          aria-current={i === current ? "step" : undefined}
          className={i < current ? "done" : i === current ? "current" : undefined}
        >
          {t[step]}
        </li>
      ))}
      {status === "disputed" && <li className="problem">{t.disputed}</li>}
    </ol>
  );
}
