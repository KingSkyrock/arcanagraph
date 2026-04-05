#!/usr/bin/env bash
# Kills stale processes, wipes Postgres + Firebase emulator data, and starts fresh.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> Killing stale processes (node, next, firebase)..."
# Kill anything on ports 3000 (next), 4000 (backend), 9099 (firebase auth), 4001 (emulator ui)
for port in 3000 4000 9099 4001; do
  pid=$(lsof -ti :"$port" 2>/dev/null || true)
  if [ -n "$pid" ]; then
    echo "    Killing PID(s) on port $port: $pid"
    kill -9 $pid 2>/dev/null || true
  fi
done

echo "==> Stopping and wiping Postgres container + volume..."
docker compose down -v 2>/dev/null || true

echo "==> Starting fresh Postgres container..."
docker compose up -d
echo "    Waiting for Postgres to be ready..."
until docker exec arcanagraph-postgres pg_isready -U postgres -q 2>/dev/null; do
  sleep 0.5
done
echo "    Postgres is ready."

echo "==> Installing dependencies (if needed)..."
npm install --silent 2>/dev/null
npm --prefix frontend install --silent 2>/dev/null
npm --prefix backend install --silent 2>/dev/null

echo "==> Starting dev servers (frontend + backend + firebase emulator)..."
exec npm run dev
