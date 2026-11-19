import "server-only";
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { listOverdueOrders } from "@/lib/automation/overdue-check";
import { inputs, McpToolError, outputs, type ToolName } from "@/lib/mcp/contracts";
import { civicTrustServices } from "@/lib/mcp/services";
import { hoursLate } from "@/lib/overdue";

// The assistant's tools are the MCP server's read-only tools, with the same input checks and the
// same output schemas (which drop coordinates, photos and identities), plus one officer-only tool
// for overdue repairs. None of them can change anything.

const descriptions: Record<ToolName, string> = {
  list_issues: "List pilot issues ranked by severity, with optional area, status, type and minimum severity filters. Returns IDs, type, status, severity, road and area names.",
  get_issue_timeline: "Public events for one issue (reported, assigned, fixed, overdue, disputed, confirmed) with event IDs and dates.",
  search_repair_policy: "Search the team's pilot repair policy (not an official city regulation). Returns cited policy sections and the deadline hours for each severity band.",
  get_contractor_scorecards: "Contractor counts: assigned, approved, rejected, disputed, on time, and on-time rate. Null rate means no eligible sample.",
  get_impact_summary: "All-time prototype KPIs with sample sizes and limitations (includes demo and test activity).",
  verify_audit_chain: "Check the hash chain of recorded audit entries: valid, broken or empty.",
};

function mcpTool(name: ToolName) {
  return createTool({
    id: name,
    description: descriptions[name],
    inputSchema: inputs[name],
    outputSchema: outputs[name],
    execute: async (args) => {
      try {
        // Parse at both edges, as the MCP server does: defaults in, privacy allowlist out.
        const invoke = civicTrustServices[name] as (a: unknown) => Promise<unknown>;
        return outputs[name].parse(await invoke(inputs[name].parse(args)));
      } catch (e) {
        // Database text can hold private details; the model only gets messages written for it.
        if (e instanceof McpToolError) throw e;
        console.error(`Assistant tool failed: ${name}`);
        throw new Error("The tool could not complete this request; no result should be inferred.");
      }
    },
  });
}

const overdueOutput = z.object({
  total: z.number().int().nonnegative(),
  repairs: z.array(
    z.object({
      work_order_id: z.number().int(),
      issue_id: z.number().int(),
      assignee_type: z.string(),
      status: z.string(),
      deadline: z.string(),
      hours_late: z.number().int().nonnegative(),
    }),
  ),
});

const listOverdueRepairs = createTool({
  id: "list_overdue_repairs",
  description: "Work orders past their repair deadline without an approved repair, most overdue first, with hours late. Use get_issue_timeline or list_issues for details of an issue.",
  inputSchema: z.object({ limit: z.number().int().min(1).max(25).default(10) }).strict(),
  outputSchema: overdueOutput,
  execute: async ({ limit }) => {
    const now = Date.now();
    const rows = await listOverdueOrders(now);
    return overdueOutput.parse({
      total: rows.length,
      repairs: rows.slice(0, limit).map((o) => ({
        work_order_id: o.id,
        issue_id: o.issue_id,
        assignee_type: o.assignee_type,
        status: o.status,
        deadline: o.deadline,
        hours_late: hoursLate(o.deadline, now),
      })),
    });
  },
});

export const assistantTools = {
  list_issues: mcpTool("list_issues"),
  get_issue_timeline: mcpTool("get_issue_timeline"),
  search_repair_policy: mcpTool("search_repair_policy"),
  get_contractor_scorecards: mcpTool("get_contractor_scorecards"),
  get_impact_summary: mcpTool("get_impact_summary"),
  verify_audit_chain: mcpTool("verify_audit_chain"),
  list_overdue_repairs: listOverdueRepairs,
};
