"use client";

/** Opens the browser's print dialog, where "Save as PDF" exports the page. */
export function PrintButton({ label }: { label: string }) {
  return (
    <button type="button" className="btn btn-outlined btn-sm" onClick={() => window.print()}>
      {label}
    </button>
  );
}
