#!/usr/bin/env bash
# Wipes the production database and re-runs the schema. All users, lobbies, matches gone.
set -euo pipefail

SERVER="root@64.23.190.70"

echo "⚠️  This will DELETE ALL DATA on the production database."
echo "   All users, lobbies, matches, and history will be wiped."
read -p "Type 'yes' to confirm: " confirm
if [ "$confirm" != "yes" ]; then
  echo "Aborted."
  exit 1
fi

echo "==> Resetting production database..."
ssh "$SERVER" "
  sudo -u postgres psql -c \"DROP DATABASE IF EXISTS arcanagraph;\"
  sudo -u postgres psql -c \"CREATE DATABASE arcanagraph;\"
  sudo -u postgres psql -d arcanagraph < /root/srv/arcanagraph/db/init/001_schema.sql

  export NVM_DIR=\"\$HOME/.nvm\"
  [ -s \"\$NVM_DIR/nvm.sh\" ] && . \"\$NVM_DIR/nvm.sh\"

  pm2 restart arcanagraph-backend
  echo '==> Database reset complete. Backend restarted.'
"
