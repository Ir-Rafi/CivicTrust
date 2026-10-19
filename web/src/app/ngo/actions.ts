"use server";

import { DEMO_PERSONA } from "@/lib/roles";
import { getSession } from "@/lib/session";
import { offerHelp } from "@/lib/workflow";

/** An NGO or volunteer group offers to fix an open issue; the ward officer decides by assigning. */
export async function offerToHelp(input: { issueId: number; ngoId: number; note?: string }) {
  const { role } = await getSession();
  if (role !== "ngo") throw new Error("NGO role required");
  return offerHelp({ ...input, actorName: DEMO_PERSONA.ngo });
}
