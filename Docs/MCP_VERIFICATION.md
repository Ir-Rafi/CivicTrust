# MCP implementation verification

Verified on 9 November 2026 at 20:13 Bangladesh time.
This records a local production-build check against the configured live backend services.
It is not evidence of a deployed public MCP endpoint or an LLM-host demonstration.

| Item | Result |
|---|---|
| Server | `civictrust` `1.0.0` |
| Endpoint tested | `http://127.0.0.1:3107/api/mcp` |
| Transport | Streamable HTTP with JSON responses |
| Client | `civictrust-smoke-client`, official TypeScript MCP SDK |
| Authentication | Separate bearer token loaded from ignored local environment configuration |
| Tool discovery | Exactly six registered tools |
| Automated tests | 65 passed, including six new MCP test cases |
| Type checking | Passed |
| ESLint | Passed |
| Production build | Passed; `/api/mcp` registered as a dynamic route |

## Real tool calls

| Tool | Result | Observed duration |
|---|---|---|
| `list_issues` | Passed; returned four non-rejected issues | 1,113 ms |
| `get_issue_timeline` | Passed for an issue returned by `list_issues` | 1,142 ms |
| `search_repair_policy` | Passed; returned three policy sections with citations | 826 ms |
| `get_contractor_scorecards` | Passed; output schema validated | 224 ms |
| `get_impact_summary` | Passed; all-time aggregates and limitations returned | 262 ms |
| `verify_audit_chain` | Passed; 140 entries, no broken entry, status `valid` | 102 ms |

These are single-run request timings, not a performance benchmark. Policy retrieval used a real
embedding request. No reports, work orders, audit entries or other database records were created
or changed. Audit validity describes stored-chain integrity, not complete event capture or repair truth.

## Protocol and boundary checks

Automated tests use the real SDK client/transport with fixture services to verify:

- Initialization, tool discovery and calls to all six tools.
- Unknown/private fields removed from both structured and text results.
- Missing/weak server configuration fails closed; missing/wrong credentials are rejected.
- The demo-role cookie cannot authorize MCP calls; disallowed Origins are rejected.
- Invalid arguments, date-filter arguments, SQL execution and payment-release requests cannot invoke services.
- Internal errors and invalid outputs do not disclose raw error messages or partial results.
- Malformed JSON, unsupported protocol versions and oversized request bodies are rejected.
- Authenticated requests are rate limited per process.

## Deployment status

Checked on 9 November 2026 with an unauthenticated `POST` to each demo deployment's `/api/mcp`:

| Deployment | Response | Meaning |
|---|---|---|
| `civictrust-eight.vercel.app` (backup) | 401 | Route deployed and a token is configured |
| `civictrust-five.vercel.app` (main demo) | 404 | Deployed build predates the MCP commit; redeploy and set `MCP_AUTH_TOKEN` |

A 401 only shows the route is live and closed to anonymous calls. The tools have not been called
against a deployed endpoint yet; run `pnpm smoke:mcp` with `MCP_URL` set to the deployment to record that.

A second local check on the same day (production build, live backend, fresh token) passed all six
tools again, rejected a missing token (401) and a disallowed Origin (403), and returned an
`isError` result for a non-existent issue ID. Follow-up fixes the same day: `area` now ignores case,
and a non-existent issue ID returns a specific "not found" message instead of the generic error.

## Reproduce and complete submission evidence

Follow [MCP_GUIDE.md](MCP_GUIDE.md). Run `pnpm smoke:mcp --json /tmp/civictrust-mcp-evidence.json`
against a running instance to save actual results without credentials. Update the verification record
after deployment. Record a connected assistant invoking tools before listing that assistant as a
demonstrated host. No external MCP-server usage or cross-project reuse was established by these tests.
