#!/bin/bash
# WebGL 3D module pre-commit verification
# Usage: bash scripts/check-webgl3d.sh
# Ref: [02_全局开发强制标准 §7.4]
set -e

echo "=== WebGL 3D Module Pre-Commit Check ==="

# 1. Feature flag must be false
if grep -q 'WEBGL3D_ENABLED = true' src/webgl3d/featureFlag.ts 2>/dev/null; then
  echo "FAIL: WEBGL3D_ENABLED is true — must be false before commit"
  exit 1
fi
echo "PASS: Feature flag is false"

# 2. No static imports from main app into webgl3d
if grep -rq "from.*@/webgl3d" src/components/ src/pages/ src/hooks/ src/stores/ src/App.tsx src/main.tsx 2>/dev/null; then
  echo "FAIL: Main app has static import from @/webgl3d"
  grep -rn "from.*@/webgl3d" src/components/ src/pages/ src/hooks/ src/stores/ src/App.tsx src/main.tsx 2>/dev/null
  exit 1
fi
echo "PASS: No static import of webgl3d from main app"

# 3. TypeScript
npx tsc --noEmit -p tsconfig.app.json
echo "PASS: TypeScript typecheck"

echo "=== All checks passed ==="
