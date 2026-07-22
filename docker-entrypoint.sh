#!/bin/sh
set -e

echo "[mailtide] Applying database migrations..."
npx prisma migrate deploy

echo "[mailtide] Seeding org + owner (idempotent)..."
npx tsx prisma/seed.ts

echo "[mailtide] Starting Next.js on ${HOST:-127.0.0.1}:${PORT:-3000} ..."
exec npx next start -H "${HOST:-127.0.0.1}" -p "${PORT:-3000}"
