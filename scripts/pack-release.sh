#!/bin/bash
# Post-build hardening — run after `npm run tauri:build`
# Compresses the release binary with UPX to reduce size and obfuscate strings.
# Requires: upx (https://upx.github.io)
# Usage: bash scripts/pack-release.sh
set -euo pipefail

EXE="src-tauri/target/release/app.exe"
if [ ! -f "$EXE" ]; then
  echo "❌ $EXE not found — run npm run tauri:build first"
  exit 1
fi

if ! command -v upx &>/dev/null; then
  echo "⚠️  UPX not installed. Install it: https://upx.github.io"
  echo "   winget install upx   (Windows)"
  echo "   brew install upx     (macOS)"
  echo "   apt install upx      (Linux)"
  echo ""
  echo "   Skipping compression — binary will be larger and strings visible."
  exit 0
fi

SIZE_BEFORE=$(stat -c%s "$EXE" 2>/dev/null || wc -c < "$EXE" | tr -d ' ')
echo "📦 Compressing $EXE..."
upx --best --lzma "$EXE" --force 2>&1
SIZE_AFTER=$(stat -c%s "$EXE" 2>/dev/null || wc -c < "$EXE" | tr -d ' ')

if [ "$SIZE_BEFORE" -gt 0 ] && [ "$SIZE_AFTER" -gt 0 ]; then
  REDUCTION=$((100 - SIZE_AFTER * 100 / SIZE_BEFORE))
  echo "✅ Done: $(numfmt --to=iec "$SIZE_BEFORE" 2>/dev/null || echo "$SIZE_BEFORE") → $(numfmt --to=iec "$SIZE_AFTER" 2>/dev/null || echo "$SIZE_AFTER") (-${REDUCTION}%)"
else
  echo "✅ Done"
fi
