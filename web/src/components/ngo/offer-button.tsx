"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { uiOfferHelp } from "@/app/actions/ui";

/** "We can help": records the group's offer; the ward officer sees it and decides by assigning. */
export function OfferButton({
  issueId,
  ngoId,
  offered,
  labels,
}: {
  issueId: number;
  ngoId: number;
  offered: boolean;
  labels: { offer: string; offered: string };
}) {
  const router = useRouter();
  const [done, setDone] = useState(offered);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (done) return <span className="tag verified">{labels.offered}</span>;
  return (
    <div>
      <button
        type="button"
        className="btn btn-tonal btn-sm"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const res = await uiOfferHelp({ issueId, ngoId });
            if (!res.ok) {
              setError(res.error);
              return;
            }
            setDone(true);
            router.refresh();
          })
        }
      >
        {labels.offer}
      </button>
      {error && (
        <p role="alert" className="label-small" style={{ color: "var(--md-error)", marginTop: 4 }}>
          {error}
        </p>
      )}
    </div>
  );
}
