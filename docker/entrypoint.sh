#!/bin/sh
set -e
mkdir -p /app/data /app/data/uploads
for f in raid-loot.json raid-journal.json; do
  if [ ! -f "/app/data/$f" ]; then
    cp "/opt/seed/$f" "/app/data/$f"
  fi
done
exec node /app/server.js
