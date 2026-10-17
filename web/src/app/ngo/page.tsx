import { Suspense } from "react";
import { ScreenPlaceholder } from "@/components/screen-placeholder";

export default function Page() {
  return (
    <Suspense>
      <ScreenPlaceholder title="NGO — claimable issues" plannedFor="plan days 8–9" />
    </Suspense>
  );
}
