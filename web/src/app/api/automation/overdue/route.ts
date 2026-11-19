import { createHash, timingSafeEqual } from "node:crypto";
import { connection } from "next/server";
import { runOverdueCheck } from "@/lib/automation/overdue-check";

// Called once a day by Vercel Cron (vercel.json) or the n8n workflow in automation/n8n, both with
// `Authorization: Bearer $CRON_SECRET`. `?dry_run=1` reports what would be recorded without writing.
// Disabled until CRON_SECRET is set.

const noStore = { "Cache-Control": "no-store" };
const digest = (text: string) => createHash("sha256").update(text).digest();

export async function GET(request: Request) {
  await connection();
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.trim().length < 16) {
    return Response.json({ error: "The overdue check is not configured." }, { status: 503, headers: noStore });
  }
  const match = /^Bearer ([^\s]+)$/i.exec(request.headers.get("authorization") ?? "");
  if (!match || !timingSafeEqual(digest(match[1]), digest(secret))) {
    return Response.json({ error: "Unauthorized." }, { status: 401, headers: noStore });
  }
  try {
    const dryRun = new URL(request.url).searchParams.get("dry_run") === "1";
    return Response.json(await runOverdueCheck({ dryRun }), { headers: noStore });
  } catch {
    // Database error text can include table details; keep it in the server log only.
    console.error("Overdue check failed");
    return Response.json({ error: "The overdue check failed." }, { status: 500, headers: noStore });
  }
}
