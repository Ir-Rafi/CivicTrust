import { Suspense } from "react";
import { ScreenPlaceholder } from "@/components/screen-placeholder";

export default function Page() {
  return (
    <Suspense>
      <ScreenPlaceholder title="Citizen — report an issue" plannedFor="plan days 3–5" />
    </Suspense>
  );
}
