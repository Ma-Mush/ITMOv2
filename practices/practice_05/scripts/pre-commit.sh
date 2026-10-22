#!/usr/bin/env bash
set -e

# Lizard Arena Pre-Commit Verification Script
echo "======================================================"
echo "🦎 [Lizard Arena] Running Pre-Commit Verification..."
echo "======================================================"

# Step 1: Run unified check (types, bundle, MCP)
./scripts/check.sh

# Step 2: End-to-End Game Verification with automated server management
echo ""
echo "▶ Starting background server for E2E Playwright test..."
npx tsx server/index.ts > /dev/null 2>&1 &
SERVER_PID=$!
trap 'kill $SERVER_PID 2>/dev/null || true' EXIT

# Wait for server to become available
MAX_RETRIES=20
COUNT=0
while ! curl -s http://localhost:3000 > /dev/null 2>&1; do
  sleep 0.3
  COUNT=$((COUNT + 1))
  if [ $COUNT -ge $MAX_RETRIES ]; then
    echo "❌ Failed to start server in time."
    exit 1
  fi
done
echo "✔ Server is responsive on http://localhost:3000."

echo "▶ Running E2E Playwright test (npm run test:e2e)..."
npm run test:e2e
echo "✔ E2E gameplay test passed."

echo "======================================================"
echo "✅ All checks passed successfully! Commit approved."
echo "======================================================"
exit 0
