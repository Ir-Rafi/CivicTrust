"use server";

import { z } from "zod";
import { DEMO_PERSONA } from "@/lib/roles";
import { getSession } from "@/lib/session";
import { listWorkOrdersForAssignee, submitRepairProof } from "@/lib/workflow";

const repairFieldsSchema = z.object({
  workOrderId: z.coerce.number().int().positive(),
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  capturedAt: z.iso.datetime(),
});

export async function submitRepair(formData: FormData) {
  const { role } = await getSession();
  if (role !== "contractor" && role !== "ngo") throw new Error("Contractor or NGO role required");
  const photo = formData.get("photo");
  if (!(photo instanceof File)) throw new Error("Repair photo is required");
  const fields = repairFieldsSchema.safeParse(Object.fromEntries(formData));
  if (!fields.success) throw new Error("Invalid repair submission");
  return submitRepairProof({
    ...fields.data,
    capturedAt: new Date(fields.data.capturedAt),
    photo,
    actorRole: role,
    actorName: DEMO_PERSONA[role],
  });
}

export async function getContractorWorkOrders(contractorId: number, status?: string) {
  const { role } = await getSession();
  if (role !== "contractor") throw new Error("Contractor role required");
  return listWorkOrdersForAssignee({ contractorId, status });
}

export async function getNgoWorkOrders(ngoId: number, status?: string) {
  const { role } = await getSession();
  if (role !== "ngo") throw new Error("NGO role required");
  return listWorkOrdersForAssignee({ ngoId, status });
}
