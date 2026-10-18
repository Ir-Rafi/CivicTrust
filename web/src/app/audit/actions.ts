"use server";

import { getSession } from "@/lib/session";
import { listAuditEntries, verifyAuditChain } from "@/lib/workflow";

export async function getAuditChainStatus() {
  return verifyAuditChain();
}

/** Officers see full entries; every other role gets citizen names and comments hidden. */
export async function getAuditEntries(input?: Omit<Parameters<typeof listAuditEntries>[0], "redact">) {
  const { role } = await getSession();
  return listAuditEntries({ ...input, redact: role !== "officer" });
}
