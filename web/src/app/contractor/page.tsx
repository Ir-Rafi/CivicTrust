import { Suspense } from "react";
import { RoleGate } from "@/components/role-gate";
import { CrewWorkspace } from "@/components/work-orders/crew-workspace";
import { getSession } from "@/lib/session";

// Repair verification runs Gemini on two photos; leave headroom on serverless platforms.
export const maxDuration = 60;

export default function ContractorPage({ searchParams }: PageProps<"/contractor">) {
  return (
    <Suspense fallback={<div style={{ height: 480 }} />}>
      <ContractorView searchParams={searchParams} />
    </Suspense>
  );
}

async function ContractorView({ searchParams }: Pick<PageProps<"/contractor">, "searchParams">) {
  const [{ lang, role }, query] = await Promise.all([getSession(), searchParams]);
  if (role !== "contractor") return <RoleGate role="contractor" lang={lang} />;
  return <CrewWorkspace kind="contractor" lang={lang} query={query} />;
}
