import { Suspense } from "react";
import { ScreenPlaceholder } from "@/components/screen-placeholder";

export default function Page() {
  return (
    <Suspense>
      <ScreenPlaceholder title="Data sources & lineage" plannedFor="plan day 10" />
    </Suspense>
  );
}
