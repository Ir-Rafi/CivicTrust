import { Suspense } from "react";
import { ScreenPlaceholder } from "@/components/screen-placeholder";

export default function Page() {
  return (
    <Suspense>
      <ScreenPlaceholder title="Ward officer — AI-ranked queue" plannedFor="plan days 6–7" />
    </Suspense>
  );
}
