import { z } from "zod";

export const ISSUE_TYPES = ["pothole", "road_crack", "garbage", "open_drain", "waterlogging", "other"] as const;
export const VISUAL_CLASSES = ["minor", "moderate", "severe"] as const;

export type IssueType = (typeof ISSUE_TYPES)[number];
export type VisualClass = (typeof VISUAL_CLASSES)[number];

/** M1: what the vision model sees in a citizen's photo. */
export const issueAnalysisSchema = z.object({
  is_civic_issue: z.boolean().describe("True only if the photo clearly shows a public road or drainage or waste problem."),
  issue_type: z.enum(ISSUE_TYPES),
  visual_class: z.enum(VISUAL_CLASSES).describe("minor: cosmetic; moderate: degrades use; severe: hazard to people or vehicles."),
  confidence: z.number().min(0).max(1),
  observations: z.string().describe("One factual sentence in English about what is visible. No speculation."),
  hazards: z.array(z.string()).describe("Visible hazards, e.g. 'blocks a lane', 'standing water hides depth'. Empty if none."),
  people_or_plates_visible: z.boolean().describe("True if faces or vehicle number plates are readable (privacy blur needed)."),
  rejection_reason: z.string().nullable().describe("If not a civic issue, why. Otherwise null."),
});
export type IssueAnalysis = z.infer<typeof issueAnalysisSchema>;

/** M3: are two photos the same physical problem? */
export const duplicateCheckSchema = z.object({
  same_issue: z.enum(["yes", "no", "unclear"]),
  confidence: z.number().min(0).max(1),
  reason: z.string(),
});
export type DuplicateCheck = z.infer<typeof duplicateCheckSchema>;

/** M4: does the after-photo show the same spot, repaired? */
export const repairCheckSchema = z.object({
  same_location: z.enum(["yes", "no", "unclear"]).describe("Do landmarks, kerbs, walls or road layout match the before photo?"),
  issue_resolved: z.enum(["yes", "partial", "no", "unclear"]),
  confidence: z.number().min(0).max(1),
  reason: z.string().describe("One sentence in English explaining the verdict, citing what is visible."),
});
export type RepairCheck = z.infer<typeof repairCheckSchema>;

/** Bilingual one-line explanation produced from computed facts. */
export const explanationSchema = z.object({
  reason_en: z.string(),
  reason_bn: z.string(),
});
export type Explanation = z.infer<typeof explanationSchema>;
