/** Read-only protocol smoke test. Start the app, then pnpm smoke:mcp [--json /tmp/evidence.json]. */
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { inputs, outputs, type ToolName } from "../src/lib/mcp/contracts";

async function main() {
  const endpoint = new URL(process.env.MCP_URL ?? "http://127.0.0.1:3000/api/mcp");
  assert.ok(endpoint.protocol === "https:" || (endpoint.protocol === "http:" && ["127.0.0.1", "localhost", "[::1]"].includes(endpoint.hostname)), "Use HTTPS except on localhost");
  assert.ok(!endpoint.username && !endpoint.password && !endpoint.search && !endpoint.hash, "Endpoint must not contain credentials or query parameters");
  const token = process.env.MCP_AUTH_TOKEN;
  assert.ok(token && token.length >= 32, "Set MCP_AUTH_TOKEN (at least 32 characters)");
  const client = new Client({ name: "civictrust-smoke-client", version: "1.0.0" });
  const transport = new StreamableHTTPClientTransport(endpoint, { requestInit: { headers: { Authorization: `Bearer ${token}` }, redirect: "error" } });
  const evidence: { name: string; duration_ms: number; result: unknown }[] = [];
  try {
    await client.connect(transport);
    const { tools } = await client.listTools();
    assert.deepEqual(tools.map((t) => t.name).sort(), Object.keys(inputs).sort());
    console.log(`Connected: ${client.getServerVersion()?.name}; discovered ${tools.length} tools.`);
    async function run(name: ToolName, args: Record<string, unknown> = {}) {
      const start = Date.now();
      const result = await client.callTool({ name, arguments: args }, undefined, { timeout: 60_000 });
      assert.notEqual(result.isError, true, `${name} returned a tool error`);
      const data = outputs[name].parse(result.structuredContent);
      evidence.push({ name, duration_ms: Date.now() - start, result: data });
      console.log(`PASS ${name} (${Date.now() - start} ms)`);
      return data;
    }
    const listed = outputs.list_issues.parse(await run("list_issues", { limit: 5 }));
    if (listed.issues[0]) await run("get_issue_timeline", { issue_id: listed.issues[0].id });
    else console.log("SKIP get_issue_timeline: no public issues exist; no sample records were created.");
    await run("search_repair_policy", { query: "Repair deadline for a severe pothole near a school", limit: 3 });
    await run("get_contractor_scorecards");
    await run("get_impact_summary");
    await run("verify_audit_chain");
    const jsonFlag = process.argv.indexOf("--json");
    if (jsonFlag >= 0) {
      const path = process.argv[jsonFlag + 1];
      assert.ok(path, "--json requires an output path");
      await writeFile(path, JSON.stringify({ checked_at: new Date().toISOString(), endpoint: endpoint.href,
        client: "civictrust-smoke-client (official TypeScript MCP SDK)", transport: "Streamable HTTP", server: client.getServerVersion(),
        tools_discovered: tools.map((t) => t.name), evidence, note: "Protocol/client verification, not an LLM-host demonstration or field evaluation." }, null, 2) + "\n", { mode: 0o600 });
      console.log("Saved evidence JSON (no credentials).");
    }
  } finally { await client.close(); }
}

main().catch((error: unknown) => {
  console.error(error instanceof assert.AssertionError ? error.message : "MCP smoke test failed. Check endpoint, token and server availability; credentials were not printed.");
  process.exitCode = 1;
});
