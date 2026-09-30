#!/usr/bin/env bash
# SMART BELL IoT - start dashboard preview + cloudflare tunnel
set -e

# --- konfigurasi (bisa di-override lewat environment variable) ---
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DASH_DIR="${DASH_DIR:-$SCRIPT_DIR/dashboard}"
PORT="${PORT:-4173}"
CLOUDFLARED_CONFIG="${CLOUDFLARED_CONFIG:-$HOME/.cloudflared/smartbel.yml}"
TUNNEL_NAME="${TUNNEL_NAME:-smartbel}"

# stop existing instances
pkill -f "vite preview --port $PORT" 2>/dev/null || true
sleep 1

cd "$DASH_DIR"

# Build ulang dist/ agar perubahan .env (VITE_*) ikut ter-inline.
# vite preview hanya menyajikan dist/ statis, jadi .env dibaca saat build, bukan saat start.
echo "--- building dashboard ---"
if [ ! -f .env ]; then
  echo "ERROR: $DASH_DIR/.env tidak ada. Salin dari .env.example lalu isi nilainya." >&2
  exit 1
fi
npm run build

if grep -rq 'PLACEHOLDER' dist/ 2>/dev/null; then
  echo "PERINGATAN: masih ada nilai 'PLACEHOLDER' di dist/. Cek isi $DASH_DIR/.env" >&2
fi

echo "--- starting preview ---"
nohup npx vite preview --port "$PORT" --host 127.0.0.1 >/tmp/smartbel-preview.log 2>&1 &
echo "preview pid: $!"

for i in $(seq 1 20); do
  if curl -s -o /dev/null "http://127.0.0.1:$PORT"; then
    echo "preview up on port $PORT"
    break
  fi
  sleep 1
done

# tunnel
pkill -f "cloudflared tunnel --config $CLOUDFLARED_CONFIG" 2>/dev/null || true
sleep 1
nohup cloudflared tunnel --config "$CLOUDFLARED_CONFIG" run "$TUNNEL_NAME" >/tmp/smartbel-tunnel.log 2>&1 &
echo "tunnel pid: $!"
sleep 8
echo "--- tunnel log tail ---"
tail -5 /tmp/smartbel-tunnel.log
