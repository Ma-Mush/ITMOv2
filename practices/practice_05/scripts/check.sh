#!/usr/bin/env bash
set -e

# Lizard Arena Unified Verification Runner
echo "======================================================"
echo "🦎 [Lizard Arena] Running Project Check (check.sh)..."
echo "======================================================"

# Step 1: TypeScript static analysis
echo "▶ [1/4] TypeScript Type Check (tsc --noEmit)..."
npx tsc --noEmit
echo "✔ TypeScript check passed."

# Step 2: Vite production build
echo "▶ [2/4] Bundling with Vite (npm run build)..."
npm run build
echo "✔ Vite build passed."

# Step 3: Skill mathematical balance verification
echo "▶ [3/4] Validating Skill Formulas (scripts/test_balance.ts)..."
npx tsx scripts/test_balance.ts
echo "✔ Skill formulas verification passed."

# Step 4: Custom MCP Server validation
echo "▶ [4/4] Testing Custom MCP Server (scripts/test_mcp.mjs)..."
node scripts/test_mcp.mjs
echo "✔ MCP Server tests passed."

echo "======================================================"
echo "✅ All verification checks passed successfully!"
echo "======================================================"
exit 0
