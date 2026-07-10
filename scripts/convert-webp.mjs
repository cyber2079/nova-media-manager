import { readdir, stat, mkdir } from 'node:fs/promises';
import { join, dirname, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const THEMES_DIR = join(ROOT, 'public', 'themes');

/**
 * Recursively find all files matching `ext` under `dir`.
 * Returns an array of absolute paths.
 */
async function* walk(dir, ext) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(full, ext);
    } else if (entry.isFile() && extname(entry.name) === ext) {
      yield full;
    }
  }
}

async function main() {
  const pngFiles = [];
  for await (const f of walk(THEMES_DIR, '.png')) {
    pngFiles.push(f);
  }

  const total = pngFiles.length;
  if (total === 0) {
    console.log('No .png files found under public/themes/');
    return;
  }

  console.log(`Found ${total} .png file(s). Scanning sizes...\n`);

  let totalPngSize = 0;
  let totalWebpSize = 0;
  let converted = 0;
  let skipped = 0;

  for (const pngPath of pngFiles) {
    const webpPath = pngPath.replace(/\.png$/i, '.webp');
    const webpDir = dirname(webpPath);
    await mkdir(webpDir, { recursive: true });

    const pngStat = await stat(pngPath);
    totalPngSize += pngStat.size;

    // Check if .webp already exists and is newer
    let webpStat;
    try {
      webpStat = await stat(webpPath);
    } catch {
      // file does not exist
    }

    if (webpStat && webpStat.mtimeMs > pngStat.mtimeMs) {
      totalWebpSize += webpStat.size;
      skipped++;
      continue;
    }

    // Convert
    const data = await sharp(pngPath)
      .webp({ lossless: true })
      .toBuffer();

    const rel = relative(THEMES_DIR, pngPath);
    const pct = (((pngStat.size - data.length) / pngStat.size) * 100).toFixed(1);
    console.log(`  [${converted + 1}/${total}] ${rel}  ${(pngStat.size / 1024).toFixed(1)} KB -> ${(data.length / 1024).toFixed(1)} KB  (${pct}% saved)`);

    await sharp(pngPath)
      .webp({ lossless: true })
      .toFile(webpPath);

    totalWebpSize += data.length;
    converted++;
  }

  console.log('\n========================================');
  console.log('            CONVERSION REPORT');
  console.log('========================================');
  console.log(`  Files converted:  ${converted}`);
  console.log(`  Files skipped:    ${skipped} (webp already newer)`);
  console.log(`  Total PNG size:   ${(totalPngSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  Total WebP size:  ${(totalWebpSize / 1024 / 1024).toFixed(2)} MB`);

  const spaceSaved = totalPngSize - totalWebpSize;
  const pctSaved = totalPngSize > 0 ? ((spaceSaved / totalPngSize) * 100).toFixed(1) : '0.0';

  console.log(`  Space saved:      ${(spaceSaved / 1024 / 1024).toFixed(2)} MB  (${pctSaved}%)`);
  console.log('========================================');
  console.log('\nOriginal .png files have been preserved.');
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
