#!/usr/bin/env bash
# One-shot deploy to production (arcanagraph.tech).
# Pushes current main to GitHub, SSHes into the droplet, pulls, builds, and restarts PM2.
set -euo pipefail

SERVER="root@64.23.190.70"
APP_ROOT="/root/srv/arcanagraph"

echo "==> Pushing main to origin..."
git push origin main

echo "==> Deploying to $SERVER..."
ssh "$SERVER" "
  export NVM_DIR=\"\$HOME/.nvm\"
  [ -s \"\$NVM_DIR/nvm.sh\" ] && . \"\$NVM_DIR/nvm.sh\"
  nvm use 22 > /dev/null

  cd $APP_ROOT
  echo '==> Pulling latest...'
  git fetch origin main
  git reset --hard origin/main

  echo '==> Installing dependencies...'
  npm install --no-fund --no-audit 2>&1 | tail -1
  npm --prefix frontend install --no-fund --no-audit 2>&1 | tail -1
  npm --prefix backend install --no-fund --no-audit 2>&1 | tail -1

  echo '==> Stopping services for clean build...'
  pm2 stop all > /dev/null 2>&1 || true

  echo '==> Building frontend...'
  rm -rf frontend/.next
  npm --prefix frontend run build 2>&1 | tail -3

  echo '==> Starting services...'
  pm2 restart all --update-env > /dev/null 2>&1 || pm2 start $APP_ROOT/ops/pm2/ecosystem.config.cjs
  pm2 save

  echo '==> Health check (waiting up to 15s)...'
  for i in 1 2 3 4 5; do
    sleep 3
    backend=\$(curl -sf http://localhost:4000/api/health 2>/dev/null && echo ok || echo fail)
    frontend=\$(curl -sf http://localhost:3000 > /dev/null 2>&1 && echo ok || echo fail)
    if [ \"\$backend\" = 'ok' ] && [ \"\$frontend\" = 'ok' ]; then
      echo 'Backend OK'
      echo 'Frontend OK'
      break
    fi
    if [ \$i -eq 5 ]; then
      [ \"\$backend\" != 'ok' ] && echo 'Backend health check failed!'
      [ \"\$frontend\" != 'ok' ] && echo 'Frontend health check failed!'
    fi
  done

  echo '==> Deploy complete at commit \$(git rev-parse --short HEAD)'
"
