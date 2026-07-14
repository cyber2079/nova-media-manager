#!/bin/bash
# Post-build hardening — run after `npm run tauri:build`
# Requires: upx (https://upx.github.io)
# Usage: bash scripts/pack-release.sh

EXE="src-tauri/target/release/app.exe"
if [ ! -f "$EXE" ]; then
  echo "❌ $EXE not found — run npm run tauri:build first"
  exit 1
fi

SIZE_BEFORE=$(stat -c%s "$EXE" 2>/dev/null || echo 0)
echo "📦 Compressing $EXE..."
upx --best --lzma "$EXE" --force 2>&1
SIZE_AFTER=$(stat -c%s "$EXE" 2>/dev/null || echo 0)

echo "✅ Done: $(numfmt --to=iec $SIZE_BEFORE 2>/dev/null || echo $SIZE_BEFORE) → $(numfmt --to=iec $SIZE_AFTER 2>/dev/null || echo $SIZE_AFTER)"
