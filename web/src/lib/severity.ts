import type { VisualClass } from "@/lib/ai/schemas";
import { CLOSE_FACILITY_M, NEARBY_FACILITY_M } from "@/lib/geo";

// M2 severity score. Deliberately a transparent formula, not a black box:
// every component is stored with the issue and shown to officers and citizens.

export type LocationContext = {
  ward: { id: number; name_en: string; name_bn: string | null } | null;
  road: { highway: string; name: string | null; distance_m: number } | null;
  nearest_school: { name: string | null; distance_m: number } | null;
  nearest_hospital: { name: string | null; distance_m: number } | null;
};

export type SeverityComponent = {
  key: "visual" | "road" | "proximity" | "reports" | "age";
  label: string;
  labelBn: string;
  points: number;
  detail: string;
  detailBn: string;
};

export type SeverityResult = {
  score: number; // 1..10
  raw: number;
  components: SeverityComponent[];
};

const VISUAL_POINTS: Record<VisualClass, number> = { minor: 2, moderate: 4, severe: 6 };
const VISUAL_BN: Record<VisualClass, string> = { minor: "সামান্য", moderate: "মাঝারি", severe: "গুরুতর" };

const MAJOR_ROADS = new Set(["motorway", "trunk", "primary", "motorway_link", "trunk_link", "primary_link"]);
const MID_ROADS = new Set(["secondary", "tertiary", "secondary_link", "tertiary_link"]);

/** Extra reports add urgency, but capped so better-connected wards can't out-vote quieter ones. */
export const REPORT_BONUS_CAP = 1;

const bnNum = (n: number) => n.toLocaleString("bn-BD", { maximumFractionDigits: 0 });

function roadClassBn(highway: string): string {
  if (MAJOR_ROADS.has(highway)) return "প্রধান সড়ক";
  if (MID_ROADS.has(highway)) return "সংযোগ সড়ক";
  if (highway === "residential" || highway === "living_street") return "আবাসিক রাস্তা";
  return "অন্যান্য রাস্তা";
}

export function computeSeverity(input: {
  visualClass: VisualClass;
  context: LocationContext;
  reportCount: number;
  daysOpen: number;
}): SeverityResult {
  const components: SeverityComponent[] = [];

  components.push({
    key: "visual",
    label: "What the photo shows",
    labelBn: "ছবিতে যা দেখা যাচ্ছে",
    points: VISUAL_POINTS[input.visualClass],
    detail: `AI visual class: ${input.visualClass}`,
    detailBn: `এআই মূল্যায়ন: ${VISUAL_BN[input.visualClass]}`,
  });

  const road = input.context.road;
  const roadPoints = !road ? 0 : MAJOR_ROADS.has(road.highway) ? 2 : MID_ROADS.has(road.highway) ? 1 : 0;
  components.push({
    key: "road",
    label: "Road importance",
    labelBn: "রাস্তার গুরুত্ব",
    points: roadPoints,
    detail: road ? `${road.highway} road${road.name ? ` (${road.name})` : ""}` : "No mapped road within 40 m",
    detailBn: road
      ? `${roadClassBn(road.highway)}${road.name ? ` (${road.name})` : ""}`
      : "৪০ মিটারের মধ্যে কোনো ম্যাপ করা রাস্তা নেই",
  });

  const sensitive = [input.context.nearest_school, input.context.nearest_hospital]
    .filter((p): p is NonNullable<typeof p> => p !== null)
    .sort((a, b) => a.distance_m - b.distance_m)[0];
  const proximityPoints = !sensitive ? 0 : sensitive.distance_m <= CLOSE_FACILITY_M ? 1.5 : sensitive.distance_m <= NEARBY_FACILITY_M ? 0.5 : 0;
  const isSchool = sensitive !== undefined && sensitive === input.context.nearest_school;
  components.push({
    key: "proximity",
    label: "Near school or hospital",
    labelBn: "স্কুল বা হাসপাতালের কাছে",
    points: proximityPoints,
    detail: sensitive
      ? `${Math.round(sensitive.distance_m)} m from a ${isSchool ? "school" : "hospital/clinic"}`
      : "None within 1 km",
    detailBn: sensitive
      ? `${isSchool ? "স্কুল" : "হাসপাতাল/ক্লিনিক"} থেকে ${bnNum(Math.round(sensitive.distance_m))} মিটার দূরে`
      : "১ কিলোমিটারের মধ্যে নেই",
  });

  const reportPoints = Math.min(REPORT_BONUS_CAP, Math.max(0, input.reportCount - 1) * 0.5);
  components.push({
    key: "reports",
    label: "Citizen reports",
    labelBn: "নাগরিক রিপোর্ট",
    points: reportPoints,
    detail: `${input.reportCount} report(s), bonus capped at +${REPORT_BONUS_CAP}`,
    detailBn: `${bnNum(input.reportCount)}টি রিপোর্ট, বোনাস সর্বোচ্চ +${bnNum(REPORT_BONUS_CAP)}`,
  });

  const days = Math.floor(Math.max(0, input.daysOpen));
  const agePoints = Math.min(1, Math.max(0, input.daysOpen) * 0.1);
  components.push({
    key: "age",
    label: "Days open",
    labelBn: "কত দিন খোলা",
    points: Number(agePoints.toFixed(2)),
    detail: `${days} day(s) open`,
    detailBn: `${bnNum(days)} দিন ধরে খোলা`,
  });

  const raw = components.reduce((sum, c) => sum + c.points, 0);
  const score = Math.min(10, Math.max(1, Math.round(raw)));
  return { score, raw: Number(raw.toFixed(2)), components };
}

/**
 * Pilot SLA: hours allowed to fix, by severity band. Mirrors data/policy/pilot-sla-policy.md,
 * which the RAG layer cites when an officer assigns a job.
 */
export function deadlineHoursFor(severity: number): { hours: number; band: string } {
  if (severity >= 8) return { hours: 48, band: "critical (8-10)" };
  if (severity >= 5) return { hours: 7 * 24, band: "high (5-7)" };
  if (severity >= 3) return { hours: 14 * 24, band: "medium (3-4)" };
  return { hours: 30 * 24, band: "low (1-2)" };
}
