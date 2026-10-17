import "server-only";
import { db } from "@/lib/supabase/server";
import type { Role } from "@/lib/roles";

/**
 * Append to the tamper-evident audit log. The database trigger computes the hash chain;
 * the table rejects UPDATE and DELETE.
 */
export async function audit(entry: {
  actorRole: Role | "system" | "ai";
  actorName: string;
  action: string;
  entity: string;
  entityId?: number | null;
  payload?: Record<string, unknown>;
}): Promise<void> {
  const { error } = await db()
    .from("audit_log")
    .insert({
      actor_role: entry.actorRole,
      actor_name: entry.actorName,
      action: entry.action,
      entity: entry.entity,
      entity_id: entry.entityId ?? null,
      payload: entry.payload ?? {},
      hash: "pending", // replaced by trigger
    });
  if (error) throw new Error(`audit log write failed: ${error.message}`);
}
