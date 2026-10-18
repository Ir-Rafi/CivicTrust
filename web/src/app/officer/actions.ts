"use server";

import { DEMO_PERSONA } from "@/lib/roles";
import { getSession } from "@/lib/session";
import {
  assignWorkOrder,
  listOfficerQueue,
  overrideIssue,
  releasePayment,
  reviewRepair,
} from "@/lib/workflow";

// The actor recorded in the audit log comes from the server-side persona, not the browser.
const OFFICER = DEMO_PERSONA.officer;

async function requireOfficer() {
  const { role } = await getSession();
  if (role !== "officer") throw new Error("Officer role required");
}

export async function getOfficerQueue(filters?: Parameters<typeof listOfficerQueue>[0]) {
  await requireOfficer();
  return listOfficerQueue(filters);
}

export async function correctIssue(input: Omit<Parameters<typeof overrideIssue>[0], "actorName">) {
  await requireOfficer();
  return overrideIssue({ ...input, actorName: OFFICER });
}

export async function createWorkOrder(input: Omit<Parameters<typeof assignWorkOrder>[0], "createdBy">) {
  await requireOfficer();
  return assignWorkOrder({ ...input, createdBy: OFFICER });
}

export async function reviewRepairProof(input: Omit<Parameters<typeof reviewRepair>[0], "actorName">) {
  await requireOfficer();
  return reviewRepair({ ...input, actorName: OFFICER });
}

export async function releaseWorkOrderPayment(input: { workOrderId: number }) {
  await requireOfficer();
  return releasePayment({ workOrderId: input.workOrderId, actorName: OFFICER });
}
