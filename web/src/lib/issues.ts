import "server-only";
import type { IssueType, VisualClass } from "@/lib/ai/schemas";
import type { StoredSeverity } from "@/lib/reports";
import { signedPhotoUrl } from "@/lib/reports";
import { db } from "@/lib/supabase/server";

export type IssueStatus =
  | "reported"
  | "verified"
  | "assigned"
  | "in_progress"
  | "fixed"
  | "confirmed"
  | "disputed"
  | "rejected";

export type IssueDetail = {
  id: number;
  issue_type: IssueType;
  visual_class: VisualClass;
  severity: number;
  severity_components: StoredSeverity;
  ai_confidence: number | null;
  ai_reason_en: string | null;
  ai_reason_bn: string | null;
  status: IssueStatus;
  report_count: number;
  road_name: string | null;
  /** OpenStreetMap area (suburb level), when it was recorded. */
  area_en: string | null;
  area_bn: string | null;
  /** Exact location: officer and crew screens only. */
  lat: number;
  lng: number;
  created_at: string;
  photoUrl: string | null;
};

export async function getIssue(id: number): Promise<IssueDetail | null> {
  const { data, error } = await db()
    .from("issues")
    .select(
      "id, issue_type, visual_class, severity, severity_components, ai_confidence, ai_reason_en, ai_reason_bn, status, report_count, road_name, area_en, area_bn, lat:location_lat, lng:location_lng, created_at, reports(photo_path, created_at)",
    )
    .eq("id", id)
    .order("created_at", { referencedTable: "reports", ascending: true })
    .maybeSingle();
  if (error) throw new Error(`getIssue: ${error.message}`);
  if (!data) return null;
  const { reports, ...issue } = data as typeof data & { reports: { photo_path: string }[] };
  return { ...(issue as Omit<IssueDetail, "photoUrl">), photoUrl: reports[0] ? await signedPhotoUrl(reports[0].photo_path) : null };
}

export type MyReport = {
  id: number;
  created_at: string;
  merged_as_duplicate: boolean;
  issue: { id: number; issue_type: IssueType; severity: number; status: IssueStatus; ai_reason_en: string | null; ai_reason_bn: string | null };
};

export async function listReportsBy(reporterName: string, limit = 20): Promise<MyReport[]> {
  const { data, error } = await db()
    .from("reports")
    .select("id, created_at, merged_as_duplicate, issue:issues(id, issue_type, severity, status, ai_reason_en, ai_reason_bn)")
    .eq("reporter_name", reporterName)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`listReportsBy: ${error.message}`);
  return data as unknown as MyReport[];
}
