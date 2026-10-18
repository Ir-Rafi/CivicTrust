"use server";

import { getSession } from "@/lib/session";
import {
  assignWorkOrder,
  listOfficerQueue,
  overrideIssue,
  releasePayment,
} from "@/lib/workflow";

async function requireOfficer() {
  const { role } = await getSession();
  if (role !== "officer") throw new Error("Officer role required");
}

export async function getOfficerQueue(filters?: Parameters<typeof listOfficerQueue>[0]) {
  await requireOfficer();
  return listOfficerQueue(filters);
}

export async function correctIssue(input: Parameters<typeof overrideIssue>[0]) {
  await requireOfficer();
  return overrideIssue(input);
}

export async function createWorkOrder(input: Parameters<typeof assignWorkOrder>[0]) {
  await requireOfficer();
  return assignWorkOrder(input);
}

export async function releaseWorkOrderPayment(input: Parameters<typeof releasePayment>[0]) {
  await requireOfficer();
  return releasePayment(input);
}
