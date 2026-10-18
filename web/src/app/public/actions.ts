"use server";

import { listContractorScorecards, listWardStats } from "@/lib/workflow";

export async function getPublicWardStats() {
  return listWardStats();
}

export async function getPublicContractorScorecards() {
  return listContractorScorecards();
}
