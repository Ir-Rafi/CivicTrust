"use server";

import { listAuditEntries, verifyAuditChain } from "@/lib/workflow";

export async function getAuditChainStatus() {
  return verifyAuditChain();
}

export async function getAuditEntries(input?: Parameters<typeof listAuditEntries>[0]) {
  return listAuditEntries(input);
}
