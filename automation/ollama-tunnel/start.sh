#!/usr/bin/env bash
# Expose this Mac's Ollama model to the hosted CivicTrust app through a Cloudflare quick tunnel,
# behind the token-checking gateway. Prints the public URL to set as OLLAMA_BASE_URL in Vercel.
#
#   OLLAMA_GATEWAY_TOKEN=<32+ random chars> ./start.sh
#
# Stops the gateway when the tunnel stops (Ctrl+C). The quick-tunnel URL changes on every start.
set -euo pipefail
cd "$(dirname "$0")"

: "${OLLAMA_GATEWAY_TOKEN:?Set OLLAMA_GATEWAY_TOKEN (at least 32 random characters), e.g. export OLLAMA_GATEWAY_TOKEN=\$(openssl rand -hex 24)}"
command -v cloudflared >/dev/null || { echo "Install cloudflared first: brew install cloudflared"; exit 1; }
curl -sf -m 3 http://127.0.0.1:11434/api/tags >/dev/null || { echo "Start Ollama first: ollama serve"; exit 1; }

node gateway.mjs &
GATEWAY=$!
trap 'kill $GATEWAY 2>/dev/null' EXIT
sleep 1

echo "Starting the tunnel. Copy the https://….trycloudflare.com URL below into Vercel as OLLAMA_BASE_URL,"
echo "and the same OLLAMA_GATEWAY_TOKEN value as OLLAMA_API_KEY. Then redeploy."
# HTTP/2 instead of QUIC: many home and campus networks block QUIC (UDP 7844).
cloudflared tunnel --no-autoupdate --protocol http2 --url http://127.0.0.1:${PORT:-11435}
