"use server";

import { askCivicTrust, type AssistantAnswer } from "@/lib/agent/assistant";
import { checkQuestion } from "@/lib/agent/rules";
import { audit } from "@/lib/audit";
import { DEMO_PERSONA } from "@/lib/roles";
import { getSession } from "@/lib/session";
import {
  assignWorkOrder,
  listIssueHistory,
  listOffers,
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

/** Full audit history of one issue and its work orders (screen 5). */
export async function getIssueHistory(issueId: number) {
  await requireOfficer();
  return listIssueHistory(issueId);
}

/** NGOs and volunteer groups that offered to fix this issue. */
export async function getIssueOffers(issueId: number) {
  await requireOfficer();
  return listOffers(issueId);
}

export async function releaseWorkOrderPayment(input: { workOrderId: number }) {
  await requireOfficer();
  return releasePayment({ workOrderId: input.workOrderId, actorName: OFFICER });
}

/** "Ask CivicTrust": a read-only agent answer, with the question and the tools used logged. */
export async function askAssistant(input: { question: string }) {
  await requireOfficer();
  const checked = checkQuestion(input.question);
  if (!checked.ok) throw new Error(checked.error === "too_long" ? "Question too long." : "Question too short.");
  let result: AssistantAnswer;
  try {
    result = await askCivicTrust(checked.question);
  } catch (e) {
    console.error("Assistant failed", e instanceof Error ? e.message.slice(0, 200) : e);
    throw new Error("The assistant is busy right now. Please try again in a minute.");
  }
  await audit({
    actorRole: "officer",
    actorName: OFFICER,
    action: "assistant_question",
    entity: "assistant",
    payload: { question: checked.question, tools: result.tools, ms: result.ms, model: result.model, lang: result.lang },
  });
  return result;
}
