"use client";

import { useEffect } from "react";

export default function Error({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="card card-low" style={{ maxWidth: 560 }}>
      <h1 className="headline-small">পৃষ্ঠাটি লোড করা যায়নি · This page couldn&apos;t load</h1>
      <p className="body-medium" style={{ margin: "6px 0 16px" }}>
        কিছু একটা ভুল হয়েছে। আবার চেষ্টা করুন। · Something went wrong. Please try again.
      </p>
      <button type="button" className="btn btn-filled" onClick={() => retry()}>
        আবার চেষ্টা করুন · Try again
      </button>
    </div>
  );
}
