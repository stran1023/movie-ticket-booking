#!/usr/bin/env bash
# Harness startup and baseline verification for CineBook.
# Run from the repo root before starting work on any feature.

set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

echo "==> CineBook harness init — $(date '+%Y-%m-%d %H:%M')"
echo "==> Working directory: $PWD"

# ── 1. Check external services ───────────────────────────────────────────────
echo ""
echo "==> Checking Redis (DB 2, cache/seat-hold)..."
if ! redis-cli -n 2 ping 2>/dev/null | grep -q PONG; then
  echo "    ERROR: Redis not responding. Run: docker-compose up -d"
  exit 1
fi
echo "    Redis OK"

echo "==> Checking PostgreSQL..."
if ! pg_isready -h localhost -p 5432 -d cinebook_db -q 2>/dev/null; then
  echo "    WARNING: Postgres not ready at localhost:5432/cinebook_db"
  echo "    Backend tests will fail. Start Postgres before running manage.py."
fi

# ── 2. Backend dependencies ───────────────────────────────────────────────────
echo ""
echo "==> Syncing backend dependencies (uv sync)..."
cd "$ROOT_DIR/backend"
uv sync --quiet

# ── 3. Backend baseline verification ─────────────────────────────────────────
echo ""
echo "==> Running backend test suite..."
uv run python manage.py test --verbosity=1 2>&1 | tail -5
echo "    Backend tests passed"

# ── 4. Frontend dependencies ──────────────────────────────────────────────────
echo ""
echo "==> Syncing frontend dependencies (pnpm install)..."
cd "$ROOT_DIR/frontend"
pnpm install --frozen-lockfile --silent

# ── 5. Frontend type check ────────────────────────────────────────────────────
echo ""
echo "==> Running frontend type check..."
pnpm run type-check
echo "    Frontend type check passed"

# ── 6. Summary ────────────────────────────────────────────────────────────────
echo ""
echo "==> Baseline verification complete. Ready to work."
echo ""
echo "    Start services:"
echo "      Terminal 1: docker-compose up -d"
echo "      Terminal 2: cd backend && uv run python manage.py runserver"
echo "      Terminal 3: cd backend && uv run celery -A config worker -l info --pool=solo"
echo "      Terminal 4: cd frontend && pnpm dev"
echo ""
echo "    Service URLs:"
echo "      Frontend  http://localhost:3000"
echo "      API       http://localhost:8000/api/"
echo "      Swagger   http://localhost:8000/api/schema/swagger-ui/"
echo "      Admin     http://localhost:8000/admin/"
