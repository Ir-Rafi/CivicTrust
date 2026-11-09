import { createMcpHandler } from "@/lib/mcp/http";
import { civicTrustServices } from "@/lib/mcp/services";

// Node.js is the default; an explicit runtime export is incompatible with Cache Components.
export const maxDuration = 60;

const handle = createMcpHandler(civicTrustServices, () => ({
  token: process.env.MCP_AUTH_TOKEN,
  allowedOrigins: process.env.MCP_ALLOWED_ORIGINS,
}));

export { handle as POST, handle as GET, handle as DELETE, handle as OPTIONS };
