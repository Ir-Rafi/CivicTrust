import { Suspense } from "react";
import { ScreenPlaceholder } from "@/components/screen-placeholder";

export default function Page() {
  return (
    <Suspense>
      <ScreenPlaceholder title="Contractor — work orders" plannedFor="plan days 8–9" />
    </Suspense>
  );
}
