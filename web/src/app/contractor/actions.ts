"use server";

import { getSession } from "@/lib/session";
import { listWorkOrdersForAssignee, submitRepairProof } from "@/lib/workflow";

export async function submitRepair(formData: FormData) {
  const { role } = await getSession();
  if (role !== "contractor" && role !== "ngo") throw new Error("Contractor or NGO role required");
  const photo = formData.get("photo");
  if (!(photo instanceof File)) throw new Error("Repair photo is required");
  const workOrderId = Number(formData.get("workOrderId"));
  const lat = Number(formData.get("lat"));
  const lng = Number(formData.get("lng"));
  const capturedAt = new Date(String(formData.get("capturedAt")));
  const actorName = String(formData.get("actorName") ?? "Demo Contractor");
  if (!Number.isInteger(workOrderId) || !Number.isFinite(lat) || !Number.isFinite(lng) || Number.isNaN(capturedAt.getTime())) {
    throw new Error("Invalid repair submission");
  }
  return submitRepairProof({ workOrderId, actorName, photo, lat, lng, capturedAt });
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
