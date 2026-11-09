import { createHash, timingSafeEqual } from "node:crypto";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import type { McpServices } from "./contracts";
import { createCivicTrustMcpServer } from "./server";

type Config = { token?: string; allowedOrigins?: string };
const digest = (text: string) => createHash("sha256").update(text).digest();
const noStore = { "Cache-Control": "no-store" };

/** Per-process abuse limits supplement the private token; deployments can add a shared gateway limit. */
export function createMcpHandler(services: McpServices, config: () => Config) {
  let windowStart = 0;
  let requests = 0;
  let active = 0;
  return async function handle(request: Request): Promise<Response> {
    const { token, allowedOrigins } = config();
    if (!token || token.trim().length < 32) {
      return Response.json({ error: "MCP is not configured." }, { status: 503, headers: noStore });
    }
    const authorization = request.headers.get("authorization") ?? "";
    const match = /^Bearer ([^\s]+)$/i.exec(authorization);
    if (!match || !timingSafeEqual(digest(match[1]), digest(token))) {
      return Response.json({ error: "A valid MCP bearer token is required." }, {
        status: 401, headers: { ...noStore, "WWW-Authenticate": 'Bearer realm="civictrust-mcp"' },
      });
    }
    const origin = request.headers.get("origin");
    const allowlist = (allowedOrigins ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    if (origin !== null && !allowlist.includes(origin)) {
      return Response.json({ error: "Origin not allowed." }, { status: 403, headers: noStore });
    }
    // No persistent sessions, standalone SSE stream, browser CORS, or session deletion.
    if (request.method !== "POST") {
      return Response.json({ error: "Use MCP Streamable HTTP POST requests." }, { status: 405, headers: { ...noStore, Allow: "POST" } });
    }
    const now = Date.now();
    if (now - windowStart >= 60_000) { windowStart = now; requests = 0; }
    if (requests >= 60 || active >= 4) {
      return Response.json({ error: "MCP request limit reached. Retry shortly." }, { status: 429, headers: { ...noStore, "Retry-After": "60" } });
    }
    requests++;
    active++;
    const server = createCivicTrustMcpServer(services);
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined, enableJsonResponse: true, maxRequestBodySize: 16 * 1024,
    });
    try {
      await server.connect(transport);
      const response = await transport.handleRequest(request);
      response.headers.set("Cache-Control", "no-store");
      return response;
    } catch {
      console.error("CivicTrust MCP transport failed");
      return Response.json({ error: "MCP request failed." }, { status: 500, headers: noStore });
    } finally {
      active--;
      await server.close();
    }
  };
}
