"use server";

import { submitFeedback } from "@/app/citizen/actions";
import { submitRepair } from "@/app/contractor/actions";
import { offerToHelp } from "@/app/ngo/actions";
import { askAssistant, correctIssue, createWorkOrder, releaseWorkOrderPayment, reviewRepairProof } from "@/app/officer/actions";

// Thin wrappers over the contract actions in BACKEND_CONTRACT.md for client forms.
// Production builds hide thrown server-action messages, so return them instead: the
// workflow's errors ("issue already has an active work order") are worth showing.

export type UiResult<T = null> = { ok: true; data: T } | { ok: false; error: string };

async function attempt<T>(fn: () => Promise<T>): Promise<UiResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    console.error(e);
    const message = e instanceof Error ? e.message : String(e);
    // zod errors are JSON; the forms validate first, so fall back to a short message.
    return { ok: false, error: message.trim().startsWith("[") ? "Invalid input." : message };
  }
}

export async function uiCorrectIssue(input: Parameters<typeof correctIssue>[0]) {
  return attempt(async () => {
    await correctIssue(input);
    return null;
  });
}

export async function uiCreateWorkOrder(input: Parameters<typeof createWorkOrder>[0]) {
  return attempt(async () => {
    await createWorkOrder(input);
    return null;
  });
}

export async function uiReviewRepair(input: Parameters<typeof reviewRepairProof>[0]) {
  return attempt(async () => {
    await reviewRepairProof(input);
    return null;
  });
}

export async function uiReleasePayment(input: { workOrderId: number }) {
  return attempt(async () => {
    await releaseWorkOrderPayment(input);
    return null;
  });
}

export async function uiSubmitFeedback(input: Parameters<typeof submitFeedback>[0]) {
  return attempt(async () => {
    await submitFeedback(input);
    return null;
  });
}

export async function uiSubmitRepair(formData: FormData) {
  return attempt(async () => {
    const proof = await submitRepair(formData);
    return {
      verdict: proof.verdict as "approved" | "rejected" | "needs_review",
      reason: proof.verdict_reason_en as string | null,
      paymentStatus: proof.paymentStatus as "eligible" | "withheld",
    };
  });
}

export async function uiOfferHelp(input: Parameters<typeof offerToHelp>[0]) {
  return attempt(async () => {
    const result = await offerToHelp(input);
    return { alreadyOffered: result.alreadyOffered };
  });
}

export async function uiAskAssistant(input: Parameters<typeof askAssistant>[0]) {
  return attempt(async () => {
    const r = await askAssistant(input);
    return { answer: r.answer, tools: r.tools };
  });
}
