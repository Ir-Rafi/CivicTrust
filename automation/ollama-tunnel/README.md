# Ollama through a Cloudflare Tunnel

Lets the hosted CivicTrust app (Vercel) use the local model on a team machine as its last
fallback for the Bangla/English explanations, after Groq and GLM.

```
Vercel app ──HTTPS──▶ Cloudflare ──tunnel──▶ cloudflared ──▶ gateway.mjs (token check) ──▶ Ollama
                                             (this machine, outbound connection only)
```

Ollama has no login, so it is never exposed directly. `gateway.mjs` sits in front of it and:

- refuses any request without `Authorization: Bearer <OLLAMA_GATEWAY_TOKEN>` (401);
- allows only `POST /api/chat` (404 for everything else, including model listing);
- allows only approved models, by default `qwen2.5:3b` (403);
- limits bodies to 32 KB, and requests to 30 per minute and 2 at a time (413, 429);
- listens on 127.0.0.1 only, and logs method, path, status and time, never tokens or contents.

## Run it

Needs Ollama (with `ollama pull qwen2.5:3b`), Node and `cloudflared` (`brew install cloudflared`).

```sh
export OLLAMA_GATEWAY_TOKEN=$(openssl rand -hex 24)   # keep this value private
./start.sh
```

The script prints a `https://….trycloudflare.com` address. In the Vercel project set:

| Setting | Value |
|---|---|
| `OLLAMA_BASE_URL` | the printed `https://….trycloudflare.com` address |
| `OLLAMA_API_KEY` | the same value as `OLLAMA_GATEWAY_TOKEN` |

Redeploy, then check `/docs` or `/model-card`: the local model is listed as configured.

## Limits

- A quick tunnel's address changes on every start, so the Vercel setting must be updated each time.
  A fixed address needs a named tunnel and a Cloudflare account with a domain.
- While the machine is off or the tunnel is stopped, the app simply skips this fallback.
- Stop the tunnel (Ctrl+C) when it is not needed.
- The script uses HTTP/2, because many networks block the QUIC protocol cloudflared tries first.

## Tested

From outside, through the tunnel: no token → 401, wrong token → 401, `GET /api/tags` → 404,
unapproved model → 403, valid call → 200. The app's `pnpm smoke:ai` got answers through the tunnel
in about 1.6 s.
