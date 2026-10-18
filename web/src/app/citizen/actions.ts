"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { submitCitizenReport } from "@/lib/reports";
import { submitCitizenFeedback } from "@/lib/workflow";
import { DEMO_PERSONA } from "@/lib/roles";
import { getSession } from "@/lib/session";

export type ReportFormState = { error: "too_old" | "bad_file" | "not_civic" | "generic"; detail?: string } | null;

const fieldsSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  accuracy: z.union([z.literal(""), z.coerce.number().nonnegative()]).optional(),
  capturedAt: z.iso.datetime(),
  locationSource: z.enum(["gps", "demo"]),
});

export async function submitReport(_prev: ReportFormState, formData: FormData): Promise<ReportFormState> {
  const photo = formData.get("photo");
  const fields = fieldsSchema.safeParse(Object.fromEntries(formData));
  if (!(photo instanceof File) || !fields.success) return { error: "bad_file" };

  let outcome;
  try {
    outcome = await submitCitizenReport({
      photo,
      lat: fields.data.lat,
      lng: fields.data.lng,
      accuracyM: typeof fields.data.accuracy === "number" ? fields.data.accuracy : null,
      capturedAt: new Date(fields.data.capturedAt),
      locationSource: fields.data.locationSource,
      reporterName: DEMO_PERSONA.citizen,
    });
  } catch (e) {
    console.error("submitReport failed", e);
    return { error: "generic" };
  }

  if (outcome.kind === "rejected") return { error: outcome.code, detail: outcome.detail };
  redirect(`/citizen/issues/${outcome.issueId}?${outcome.kind === "merged" ? "merged" : "new"}=1`);
}

export async function submitFeedback(input: Parameters<typeof submitCitizenFeedback>[0]) {
  const { role } = await getSession();
  if (role !== "citizen") throw new Error("Citizen role required");
  return submitCitizenFeedback(input);
}
