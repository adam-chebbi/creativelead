#!/bin/bash
# AutoReach V2 — Production Deploy Script
# Usage: bash /var/www/autoreach/deploy.sh
# Triggered automatically by GitHub Actions on push to main.

set -euo pipefail

APP_DIR="/var/www/autoreach"
COMPOSE="docker compose -f $APP_DIR/docker-compose.yml"

echo "══════════════════════════════════════════════"
echo "  AutoReach V2 — Deploy @ $(date '+%Y-%m-%d %H:%M:%S')"
echo "══════════════════════════════════════════════"

# ── 1. Pull latest code ───────────────────────────────────────────
echo "▶ [1/6] Pulling latest code..."
cd "$APP_DIR"
git pull origin main

# ── 2. Rebuild only application images (not postgres/nginx) ───────
echo "▶ [2/6] Building api and dashboard images..."
$COMPOSE build --no-cache api dashboard

# ── 3. Recreate only the changed containers (leave postgres & nginx running) ──
echo "▶ [3/6] Restarting api and dashboard containers..."
$COMPOSE up -d --no-deps api dashboard

# ── 4. Wait for Node to start, then run migrations ────────────────
echo "▶ [4/6] Waiting for API to initialize..."
sleep 8
$COMPOSE exec -T api npx prisma migrate deploy

# ── 5. Health checks ──────────────────────────────────────────────
echo "▶ [5/6] Running health checks..."

API_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://leads.creativecomet.tn/api/health || echo "000")
DASH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://leads.creativecomet.tn || echo "000")

if [ "$API_STATUS" = "200" ]; then
  echo "  ✓ API is healthy (HTTP $API_STATUS)"
else
  echo "  ✗ API health check FAILED (HTTP $API_STATUS)"
fi

if [ "$DASH_STATUS" = "200" ]; then
  echo "  ✓ Dashboard is healthy (HTTP $DASH_STATUS)"
else
  echo "  ✗ Dashboard health check FAILED (HTTP $DASH_STATUS)"
fi

# ── 6. Show running containers ────────────────────────────────────
echo "▶ [6/6] Container status:"
$COMPOSE ps

echo ""
echo "══════════════════════════════════════════════"
echo "  Deploy complete!"
echo "══════════════════════════════════════════════"

# Exit with failure if either service is unhealthy
if [ "$API_STATUS" != "200" ] || [ "$DASH_STATUS" != "200" ]; then
  echo "WARNING: One or more services failed health checks."
  exit 1
fi
