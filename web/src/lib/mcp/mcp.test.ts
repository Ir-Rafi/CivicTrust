import assert from "node:assert/strict";
import { test } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { LATEST_PROTOCOL_VERSION } from "@modelcontextprotocol/sdk/types.js";
import { inputs, McpToolError, type McpServices } from "./contracts";
import { createMcpHandler } from "./http";

const TOKEN = "test-only-token-not-a-real-secret-123456789";
const URL = "http://localhost:3000/api/mcp";
const SECRET = "PRIVATE_SENTINEL";
const ratio = { of: 0, pct: null };

function fixtures(): McpServices {
  return {
    list_issues: async () => ({ issues: [{ id: 1, issue_type: "pothole", severity: 8, status: "verified", road_name: "Test road",
      area_en: "Lalmatia", area_bn: "লালমাটিয়া", report_count: 1, created_at: "2026-11-09T00:00:00Z",
      lat: 23.7, lng: 90.3, photoUrl: SECRET, reporter_name: SECRET, severity_components: { private: SECRET } }], next_offset: null, private: SECRET }),
    get_issue_timeline: async () => ({ issue_id: 1, stage: "reported", events: [{ id: 1, at: "2026-11-09T00:00:00Z",
      kind: "reported", verified_by: null, payload: { comment: SECRET }, actor_name: SECRET }], has_more: false }),
    search_repair_policy: async () => ({ policy_status: "Team-authored pilot policy; not an official city regulation.",
      matches: [{ id: 1, source: "pilot.md", title: "Deadline", content: "48 hours", similarity: 0.9, embedding: [SECRET] }],
      deadline_rules: [{ minimum_severity: 8, maximum_severity: 10, hours: 48, band: "critical" }] }),
    get_contractor_scorecards: async () => ({ contractors: [{ contractor_id: 1, contractor_name: "Demo contractor", company: null,
      assigned_count: 0, approved_count: 0, rejected_count: 0, disputed_count: 0, on_time_count: 0, on_time_rate: null, phone: SECRET }], next_offset: null }),
    get_impact_summary: async () => ({ scope: "all_time", counts: { issues: 0, reports: 0, workOrders: 0, repairProofs: 0, feedback: 0 },
      triage_ms: { n: 0, median: null, p90: null, samples: [SECRET] }, duplicate_merge: { merged: 0, ...ratio }, payments_backed: { backed: 0, ...ratio },
      audit_completion: { recorded: 0, ...ratio }, photo_analysis: { ok: 0, failed: 0, ...ratio }, limitations: ["Demo data, not field impact."] }),
    verify_audit_chain: async () => ({ total: 0, first_broken_id: null, status: "empty", limitation: "Not proof of completeness.", secret: SECRET }),
  };
}

function request(body: unknown, headers: Record<string, string> = {}) {
  return new Request(URL, { method: "POST", headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json",
    Accept: "application/json, text/event-stream", "MCP-Protocol-Version": LATEST_PROTOCOL_VERSION, ...headers }, body: JSON.stringify(body) });
}
const call = (name: string, args: unknown = {}) => ({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } });

test("real SDK client discovers and calls all six tools; both result formats exclude private fields", async () => {
  const handle = createMcpHandler(fixtures(), () => ({ token: TOKEN }));
  const client = new Client({ name: "civictrust-test-client", version: "1.0.0" });
  const transport = new StreamableHTTPClientTransport(new globalThis.URL(URL), {
    requestInit: { headers: { Authorization: `Bearer ${TOKEN}` } },
    fetch: async (url, init) => handle(new Request(url, init)),
  });
  try {
    await client.connect(transport);
    const { tools } = await client.listTools();
    assert.deepEqual(tools.map((t) => t.name).sort(), Object.keys(inputs).sort());
    for (const tool of tools) {
      assert.equal(tool.annotations?.readOnlyHint, true);
      assert.ok(tool.outputSchema);
      const args = tool.name === "get_issue_timeline" ? { issue_id: 1 } : tool.name === "search_repair_policy" ? { query: "repair deadline" } : {};
      const result = await client.callTool({ name: tool.name, arguments: args });
      assert.notEqual(result.isError, true);
      assert.ok(result.structuredContent);
      assert.equal(JSON.stringify(result).includes(SECRET), false);
      assert.equal(JSON.stringify(result).includes('"lat"'), false);
    }
  } finally { await client.close(); }
});

test("missing configuration, bearer authentication and Origin enforcement fail closed", async () => {
  assert.equal((await createMcpHandler(fixtures(), () => ({}))(request(call("list_issues")))).status, 503);
  assert.equal((await createMcpHandler(fixtures(), () => ({ token: "short" }))(request(call("list_issues")))).status, 503);
  const handle = createMcpHandler(fixtures(), () => ({ token: TOKEN, allowedOrigins: "http://localhost:6274" }));
  for (const Authorization of ["", "Bearer wrong", "Basic credentials"]) {
    const res = await handle(request(call("list_issues"), { Authorization, Cookie: "ct_role=officer" }));
    assert.equal(res.status, 401);
    assert.equal(res.headers.get("Cache-Control"), "no-store");
  }
  assert.equal((await handle(request(call("list_issues"), { Origin: "https://attacker.example" }))).status, 403);
  assert.equal((await handle(request(call("list_issues"), { Origin: "null" }))).status, 403);
  assert.equal((await handle(request(call("list_issues"), { Origin: "http://localhost:6274" }))).status, 200);
  for (const method of ["GET", "DELETE", "OPTIONS"]) {
    const res = await handle(new Request(URL, { method, headers: { Authorization: `Bearer ${TOKEN}` } }));
    assert.equal(res.status, 405);
    assert.equal(res.headers.get("Allow"), "POST");
  }
});

test("invalid arguments, unknown tools and write tools never reach a service", async () => {
  let calls = 0;
  const services = fixtures();
  for (const name of Object.keys(services) as (keyof McpServices)[]) services[name] = async () => { calls++; return {}; };
  const handle = createMcpHandler(services, () => ({ token: TOKEN }));
  for (const body of [call("list_issues", { limit: 1000 }), call("list_issues", { status: "rejected" }),
    call("get_issue_timeline", { issue_id: -1 }), call("search_repair_policy", { query: "x".repeat(501) }),
    call("get_impact_summary", { since: "2026-11-01" }), call("release_payment"), call("execute_sql")]) {
    const res = await handle(request(body));
    const json = await res.json();
    assert.ok(json.error || json.result?.isError);
  }
  assert.equal(calls, 0);
});

test("service errors and invalid output never expose raw database errors or partial private results", async () => {
  const services = fixtures();
  services.list_issues = async () => { throw new Error(SECRET); };
  services.verify_audit_chain = async () => ({ total: SECRET, private: SECRET });
  const handle = createMcpHandler(services, () => ({ token: TOKEN }));
  for (const name of ["list_issues", "verify_audit_chain"]) {
    const json = await (await handle(request(call(name)))).json();
    assert.equal(json.result.isError, true);
    assert.equal(JSON.stringify(json).includes(SECRET), false);
  }
});

test("client-safe tool errors such as an unknown issue reach the assistant with their message", async () => {
  const services = fixtures();
  services.get_issue_timeline = async ({ issue_id }) => { throw new McpToolError(`Issue ${issue_id} was not found or is not public.`); };
  const handle = createMcpHandler(services, () => ({ token: TOKEN }));
  const json = await (await handle(request(call("get_issue_timeline", { issue_id: 999 })))).json();
  assert.equal(json.result.isError, true);
  assert.equal(json.result.content[0].text, "Issue 999 was not found or is not public.");
});

test("transport rejects malformed JSON, oversized bodies and unsupported protocol versions", async () => {
  const handle = createMcpHandler(fixtures(), () => ({ token: TOKEN }));
  const base = request(call("list_issues"));
  assert.equal((await handle(new Request(URL, { method: "POST", headers: base.headers, body: "{" }))).status, 400);
  assert.equal((await handle(request(call("search_repair_policy", { query: "x".repeat(17000) })))).status, 413);
  assert.equal((await handle(request(call("list_issues"), { "MCP-Protocol-Version": "unsupported" }))).status, 400);
});

test("authenticated requests are rate limited per process", async () => {
  const handle = createMcpHandler(fixtures(), () => ({ token: TOKEN }));
  for (let i = 0; i < 60; i++) assert.equal((await handle(request({ jsonrpc: "2.0", method: "notifications/initialized" }))).status, 202);
  const res = await handle(request(call("list_issues")));
  assert.equal(res.status, 429);
  assert.equal(res.headers.get("Retry-After"), "60");
});
