#!/usr/bin/env bash
# Boot the demo MCP server + a public cloudflared tunnel, then print the ready-to-paste
# custom-connector URL for Claude (Settings → Connectors → Add custom connector → <URL>/mcp).
#
# Usage:
#   scripts/start-tunnel.sh                 # static catalog (default, zero setup)
#   CATALOG_SOURCE=firestore \
#     GOOGLE_APPLICATION_CREDENTIALS=./serviceAccount.json scripts/start-tunnel.sh
#
# Env: PORT (default 3001), CATALOG_SOURCE (default static). Ctrl-C stops both.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PORT:-3001}"
export CATALOG_SOURCE="${CATALOG_SOURCE:-static}"
LOG_DIR="$(mktemp -d)"
SERVER_LOG="$LOG_DIR/server.log"
TUNNEL_LOG="$LOG_DIR/tunnel.log"

cleanup() { kill "${SERVER_PID:-}" "${TUNNEL_PID:-}" 2>/dev/null || true; }
trap cleanup EXIT INT TERM

echo "▸ building (clean)…"
# Clean first: tsc doesn't remove artifacts for deleted sources, and a stale
# dist/app.js from before the attestomcp migration carries an old host allowlist
# that 403s tunnel traffic. A clean build avoids that.
rm -rf dist
npm run build >/dev/null

echo "▸ starting cloudflared tunnel…"
cloudflared tunnel --url "http://localhost:$PORT" >"$TUNNEL_LOG" 2>&1 &
TUNNEL_PID=$!

# Wait for cloudflared to print its public https URL.
PUBLIC_URL=""
for _ in $(seq 1 30); do
  PUBLIC_URL="$(grep -oE 'https://[a-zA-Z0-9.-]+\.trycloudflare\.com' "$TUNNEL_LOG" | head -1 || true)"
  [ -n "$PUBLIC_URL" ] && break
  sleep 1
done
if [ -z "$PUBLIC_URL" ]; then
  echo "✗ tunnel did not come up; log:"; cat "$TUNNEL_LOG"; exit 1
fi

echo "▸ starting MCP server (catalog source: $CATALOG_SOURCE)…"
PORT="$PORT" PUBLIC_BASE_URL="$PUBLIC_URL" node dist/main.js >"$SERVER_LOG" 2>&1 &
SERVER_PID=$!
sleep 2

cat <<EOF

────────────────────────────────────────────────────────────
✅ Custom connector URL (paste into Claude):

    $PUBLIC_URL/mcp

   catalog source: $CATALOG_SOURCE   ·   local port: $PORT
   logs: $SERVER_LOG
────────────────────────────────────────────────────────────
Leave this running while you use the connector. Ctrl-C to stop.
EOF

wait
