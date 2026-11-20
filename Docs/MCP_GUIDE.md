# CivicTrust MCP server

CivicTrust exposes six read-only tools through one Streamable HTTP endpoint, `/api/mcp`.
An assistant can query the existing issue workflow, policy retrieval, scorecards, KPIs and audit
chain. No database migration or frontend change is required.

## Inventory

| Item | Implementation |
|---|---|
| Server | `civictrust`, version `1.0.0` |
| HTTP endpoint | `/api/mcp` |
| Transport | Streamable HTTP, stateless JSON responses |
| SDK | Official `@modelcontextprotocol/sdk`, pinned in `web/package.json` |
| Authentication | Dedicated bearer token, configured by the operator |
| Client included | `civictrust-smoke-client`, using the official TypeScript SDK |
| Assistant configuration | `mcp.example.json` for Claude Code |
| Reuse | Shared backend functions inside CivicTrust |

| Tool | Arguments | Result |
|---|---|---|
| `list_issues` | Optional `area`, `status`, `issue_type`, `min_severity`, `limit` (1–25), `offset` | Severity-ranked issues, road/area names and next offset; rejected issues excluded |
| `get_issue_timeline` | `issue_id`, optional `limit` (1–50) | Latest public events in chronological order, event IDs, current stage and whether earlier events were omitted |
| `search_repair_policy` | `query` (3–500 characters), optional `limit` (1–5) | Retrieved sections with sources/similarity plus deterministic deadline bands |
| `get_contractor_scorecards` | Optional `limit` (1–25), `offset` | Public contractor counts/rates and next offset |
| `get_impact_summary` | None | All-time aggregates with denominators and limitations |
| `verify_audit_chain` | None | Entry count, first broken entry, and `valid`, `broken` or `empty` status |

`area` is an English OpenStreetMap area name, matched whole and ignoring case; it is used until official ward boundaries are loaded. Omit it to
discover recorded areas. `status` uses the app's internal states: reported, verified, assigned,
in_progress, fixed, confirmed or disputed. Omit it to include all non-rejected issues.

## Run locally

From `web/`, use Node 24 and install dependencies with `pnpm install`.
The existing Supabase and Gemini configuration must be present in `.env.local`.

Set a separate, random `MCP_AUTH_TOKEN` of at least 32 characters in `.env.local`. Without a valid
configured token, MCP returns 503.

```bash
pnpm dev --hostname 127.0.0.1
# In a second terminal, from web/:
pnpm smoke:mcp --json /tmp/civictrust-mcp-evidence.json
```

The smoke client loads `.env.local`, initializes the protocol, discovers six tools and invokes them
against the running app. Timeline verification is explicitly skipped if no public issue exists.
Other tool errors fail the run. It makes no database writes. Policy search makes an embedding API
request and may consume provider quota. The optional evidence file contains public-safe results and
no credentials; review it before sharing because it describes the current project data.

Set `MCP_URL` to use another local port or a deployed HTTPS endpoint. The smoke client refuses
non-local HTTP URLs and URLs containing credentials or query parameters.

## Connect an assistant

The root `mcp.example.json` uses environment-variable placeholders, not secrets. For Claude Code,
export `MCP_AUTH_TOKEN` securely into the terminal environment, optionally set `MCP_URL`, then run
from the repository root:

```bash
claude --mcp-config mcp.example.json --strict-mcp-config
```

Use `/mcp` to confirm the connection and tool availability. The app's `.env.local` is not
automatically loaded by Claude Code. Never paste the token into the chat or a recording.
The server uses preconfigured bearer credentials; choose a client that supports custom
Authorization headers. OAuth can be added for hosts that require it.

Suggested demonstration prompt:

> Use CivicTrust MCP to list up to five urgent issues, retrieve the repair deadline policy, and
> verify the audit chain. Give a short Bangla briefing with issue IDs, policy sources and limitations.

Assignment, repair review and payment status changes stay in the officer interface.

## Deployment

1. Deploy the `web/` application to Vercel.
2. Add `MCP_AUTH_TOKEN` as a sensitive server environment variable and redeploy.
3. Configure the client with the matching token and `https://<deployment>/api/mcp`.
4. Run `pnpm smoke:mcp` against that URL and record a real assistant tool call.

An ordinary browser visit is not a protocol test. Authenticated GET/DELETE/OPTIONS requests return
405 because the server does not offer a standalone SSE stream, persistent sessions or browser CORS.
Missing/incorrect credentials return 401. Origin-bearing requests require an exact match in
`MCP_ALLOWED_ORIGINS` (comma-separated); no Origin is allowed with a valid token. Browser Inspector
clients should use their proxy, or an explicitly allowed origin where applicable.

The server admits at most 60 authenticated POSTs per minute and four concurrent requests **per
process**. For broad public access, a shared gateway limit across Vercel instances is the next step. Request bodies are limited to 16 KiB; issue and scorecard outputs are paginated.

## Data boundaries and interpretation

- The MCP token is independent of the browser's demo-role cookie and does not grant database access.
- Only the six registered read tools exist. There is no SQL execution, arbitrary URL fetching,
  assignment, photo submission, repair approval or payment-release tool.
- Validated output schemas remove unlisted fields, including coordinates, photo URLs, citizen
  identities, raw audit payloads and embedding vectors. Contractor names are public scorecard fields.
- Database/provider error details are not returned to clients. Results are marked `no-store`.
- Retrieved text is data, not instructions. Tool descriptions and server instructions require
  citations and preservation of limitations, and validated output schemas enforce the data boundary.
- Policy retrieval uses the team-authored pilot policy. Deadline calculations remain deterministic.
- KPI summaries intentionally use all-time records, ignoring `KPI_SINCE`; date-filtered cohorts are
  not offered through MCP. Demo/testing activity is included, and response success is not accuracy.
- A valid audit chain proves integrity of recorded entries, not audit completeness or real repair quality.
- Access uses one shared token; per-user authorization comes with production sign-in.

## Verification and submission evidence

The local and deployed verification results are recorded in [MCP_VERIFICATION.md](MCP_VERIFICATION.md).

`pnpm test` exercises discovery and all six calls through an official MCP SDK client, output privacy,
authentication, Origin checks, argument validation, unsupported operations, error redaction, request
size limits and rate limiting. Those automated protocol tests use fixtures; `pnpm smoke:mcp` exercises
the real backend separately. Type checking, lint and production build remain part of CI.

In summary: **one server, one HTTP endpoint and six read-only tools**, with an included SDK client.

References: [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk),
[Streamable HTTP](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports),
[MCP Inspector](https://modelcontextprotocol.io/docs/tools/inspector),
[Claude Code MCP configuration](https://code.claude.com/docs/en/mcp).
