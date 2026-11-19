# CivicTrust

Hackathon prototype (AIBC 2026, CivicSphere). Plan, scope and judging alignment: `PROTOTYPE_PLAN.md`.
App lives in `web/` — read `web/AGENTS.md` (Next.js 16: check `web/node_modules/next/dist/docs/` before writing Next code).

- Node 24 via nvm (`source ~/.nvm/nvm.sh && nvm use`); the user's nvm default is 20, which supabase-js no longer supports.
- Package manager: pnpm. Checks: `pnpm test && pnpm typecheck && pnpm lint && pnpm build` in `web/`.
- Cache Components is on: anything reading cookies or the DB goes inside `<Suspense>`.
- No login by design: role + language come from cookies (`src/lib/session.ts`). Database access is server-only via `db()` with the secret key; never expose it with `NEXT_PUBLIC_`.
- AI split: Gemini = vision (M1/M3/M4) + embeddings; Groq = text (primary), GLM = text fallback (`glm-4.7-flash`, thinking disabled; `glm-4.5-flash` is no longer free); Ollama (`qwen2.5:3b`) = optional last text fallback, only where `OLLAMA_BASE_URL` is set. Every AI result shown must be computed live (fabricated demos disqualify).
- Officer assistant (`src/lib/agent`): a Mastra agent on Groq with read-only tools only (the MCP tools plus overdue repairs). Never give it a tool that writes; officers act in the app.
- Daily overdue check: `GET /api/automation/overdue` with `Authorization: Bearer $CRON_SECRET` (Vercel Cron in `web/vercel.json`, or n8n in `automation/n8n`); `?dry_run=1` writes nothing. All deployments share one database, so set `CRON_SECRET` on one deployment only.
- Severity formula in `src/lib/severity.ts` must stay in sync with `web/data/policy/pilot-sla-policy.md`.
- Every state change and AI override writes to the audit log (`src/lib/audit.ts`).
