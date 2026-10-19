"use server";

import { listPublicIssues, listPublicLog } from "@/lib/public-log";
import { listContractorScorecards, listWardStats } from "@/lib/workflow";

export async function getPublicWardStats() {
  return listWardStats();
}

export async function getPublicContractorScorecards() {
  return listContractorScorecards();
}

/** Where each problem was reported and whether it is assigned or fixed. No coordinates or names. */
export async function getPublicIssues(limit?: number) {
  return listPublicIssues(limit);
}

/** Plain-language log of reports, assignments, fixes and citizen feedback. */
export async function getPublicLog(limit?: number) {
  return listPublicLog(limit);
}
