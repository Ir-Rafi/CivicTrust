import { Suspense } from "react";
import { ScreenPlaceholder } from "@/components/screen-placeholder";

export default function Page() {
  return (
    <Suspense>
      <ScreenPlaceholder title="Security & responsible AI" plannedFor="plan day 10" />
    </Suspense>
  );
}
