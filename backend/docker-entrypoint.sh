#!/bin/sh
set -e

if [ -n "$DATABASE_URL" ]; then
  echo "[ENTRYPOINT] Running Prisma migrate..."
  npx prisma migrate deploy
fi

exec "$@"
