import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

// Collect all PNG/JPG that have WebP versions
const hasWebP = new Set();
function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith(".webp")) hasWebP.add(p);
  }
}
walk(path.join(root, "public/themes"));
console.log(`WebP files: ${hasWebP.size}`);

// Find src files
const srcFiles = [];
function walkSrc(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walkSrc(p);
    else if (/\.(tsx?|css)$/.test(e.name)) srcFiles.push(p);
  }
}
walkSrc(path.join(root, "src"));

let count = 0;
let replCount = 0;
for (const file of srcFiles) {
  let src = fs.readFileSync(file, "utf8");
  const original = src;
  let fileChanged = false;

  // Find all /themes/...ext or themes/...ext references
  const regex = /(["'`])([^"'`]*?)(\.(?:png|jpg|jpeg))(["'`\/)\s,;>])/gi;
  src = src.replace(regex, (full, q1, qualified, ext, q2) => {
    // qualified might include a leading "/themes/" or "themes/" fragment
    // We need to find the full path starting from /themes/
    const startIdx = full.search(/\/themes\/|themes\//i);
    if (startIdx === -1) return full;

    const pathWithExt = full.slice(startIdx, full.length - q2.length);
    const withoutExt = pathWithExt.replace(/\.(png|jpg|jpeg)$/i, "");

    // Build absolute path to check against hasWebP
    const absPath = path.join(root, "public", withoutExt.replace(/^\//, ""));
    if (hasWebP.has(absPath)) {
      fileChanged = true;
      replCount++;
      return q1 + qualified + ".webp" + q2;
    }
    return full;
  });

  if (fileChanged) {
    fs.writeFileSync(file, src);
    console.log(`  ${path.relative(root, file)}`);
    count++;
  }
}

console.log(`\nUpdated ${count} files, ${replCount} replacements`);

// Also update themeShortcutStore which has dynamic fileName references
const tssPath = path.join(root, "src/stores/themeShortcutStore.ts");
let tss = fs.readFileSync(tssPath, "utf8");
let tssChanged = 0;
tss = tss.replace(/fileName: "([^"]+)\.(png|jpg|jpeg)"/gi, (full, name, ext) => {
  return `fileName: "${name}.webp"`;
});
if (tss !== fs.readFileSync(tssPath, "utf8")) {
  fs.writeFileSync(tssPath, tss);
  console.log(`  themeShortcutStore (${tss.match(/\.webp"/g)?.length || 0} fileName refs)`);
  count++;
}

// Do the same for the icon maps in Layout.tsx
// Already handled by the regex replacement above

console.log(`\nTotal: ${count} files updated`);
