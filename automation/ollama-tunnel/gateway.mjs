// Token-checking gateway in front of a local Ollama server, so it can be reached through a
// Cloudflare Tunnel without letting anyone else use the model. Ollama itself has no login.
// Allows only POST /api/chat with an approved model, small bodies and a modest request rate.
//
//   OLLAMA_GATEWAY_TOKEN=<32+ random chars> node gateway.mjs
//
// Settings: OLLAMA_GATEWAY_TOKEN (required), OLLAMA_UPSTREAM (default http://127.0.0.1:11434),
// OLLAMA_ALLOWED_MODELS (comma-separated, default qwen2.5:3b), PORT (default 11435).
import { createHash, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";

const TOKEN = process.env.OLLAMA_GATEWAY_TOKEN ?? "";
if (TOKEN.trim().length < 32) {
  console.error("Set OLLAMA_GATEWAY_TOKEN to a random value of at least 32 characters.");
  process.exit(1);
}
const UPSTREAM = (process.env.OLLAMA_UPSTREAM ?? "http://127.0.0.1:11434").replace(/\/$/, "");
const MODELS = new Set((process.env.OLLAMA_ALLOWED_MODELS ?? "qwen2.5:3b").split(",").map((m) => m.trim()).filter(Boolean));
const PORT = Number(process.env.PORT ?? 11435);
const MAX_BODY = 32 * 1024;
const PER_MINUTE = 30;
const MAX_ACTIVE = 2;

const digest = (text) => createHash("sha256").update(text).digest();
const expected = digest(TOKEN);
let windowStart = 0;
let requests = 0;
let active = 0;

const reply = (res, status, body) => {
  res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
  res.end(JSON.stringify(body));
};

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) throw Object.assign(new Error("too large"), { status: 413 });
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

const server = createServer(async (req, res) => {
  const started = Date.now();
  let status = 500;
  try {
    const match = /^Bearer ([^\s]+)$/i.exec(req.headers.authorization ?? "");
    if (!match || !timingSafeEqual(digest(match[1]), expected)) return reply(res, (status = 401), { error: "A valid bearer token is required." });
    if (req.method !== "POST" || req.url !== "/api/chat") return reply(res, (status = 404), { error: "Only POST /api/chat is available." });

    const now = Date.now();
    if (now - windowStart >= 60_000) {
      windowStart = now;
      requests = 0;
    }
    if (requests >= PER_MINUTE || active >= MAX_ACTIVE) return reply(res, (status = 429), { error: "Too many requests. Retry shortly." });

    let body;
    try {
      body = JSON.parse(await readBody(req));
    } catch (e) {
      return reply(res, (status = e.status ?? 400), { error: e.status === 413 ? "Request body too large." : "Body must be JSON." });
    }
    if (!MODELS.has(body?.model)) return reply(res, (status = 403), { error: "Model not allowed." });

    requests++;
    active++;
    try {
      const upstream = await fetch(`${UPSTREAM}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Streaming is never needed by CivicTrust and would hold connections open.
        body: JSON.stringify({ ...body, stream: false }),
        signal: AbortSignal.timeout(60_000),
      });
      status = upstream.status;
      res.writeHead(upstream.status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
      res.end(await upstream.text());
    } finally {
      active--;
    }
  } catch {
    if (!res.headersSent) reply(res, (status = 502), { error: "The local model is unavailable." });
  } finally {
    // Method, path, status and time only: never the token or the request body.
    console.log(`${new Date().toISOString()} ${req.method} ${req.url} ${status} ${Date.now() - started}ms`);
  }
});

// Loopback only: the tunnel connects from this machine, nothing else on the network can.
server.listen(PORT, "127.0.0.1", () => console.log(`Ollama gateway on http://127.0.0.1:${PORT} → ${UPSTREAM} (models: ${[...MODELS].join(", ")})`));
