# CivicTrust

Hackathon prototype (AIBC 2026, CivicSphere). Plan, scope and judging alignment: `PROTOTYPE_PLAN.md`.
App lives in `web/` — read `web/AGENTS.md` (Next.js 16: check `web/node_modules/next/dist/docs/` before writing Next code).

- Node 24 via nvm (`source ~/.nvm/nvm.sh && nvm use`); the user's nvm default is 20, which supabase-js no longer supports.
- Package manager: pnpm. Checks: `pnpm test && pnpm typecheck && pnpm lint && pnpm build` in `web/`.
- Cache Components is on: anything reading cookies or the DB goes inside `<Suspense>`.
- No login by design: role + language come from cookies (`src/lib/session.ts`). Database access is server-only via `db()` with the secret key; never expose it with `NEXT_PUBLIC_`.
- AI split: Gemini = vision (M1/M3/M4) + embeddings; Groq = text. Every AI result shown must be computed live (fabricated demos disqualify).
- Severity formula in `src/lib/severity.ts` must stay in sync with `web/data/policy/pilot-sla-policy.md`.
- Every state change and AI override writes to the audit log (`src/lib/audit.ts`).
