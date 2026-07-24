// List files where Lucide icons are used without NeonIcon wrapper
import { readFileSync, readdirSync } from "fs";
import { join } from "path";

const icons = JSON.parse(readFileSync(join("src", "components", "neon-icon-data.json"), "utf-8"));
const known = new Set(Object.keys(icons));

function walk(dir, cb) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, cb);
    else if (e.name.endsWith(".tsx")) cb(p);
  }
}

const resultMap = new Map();

walk("src", (filePath) => {
  const c = readFileSync(filePath, "utf-8");
  if (!c.includes("lucide-react")) return;

  const fileImports = new Set();
  for (const line of c.split("\n")) {
    if (!line.includes("lucide-react")) continue;
    const m = line.match(/\{([^}]+)\}/);
    if (!m) continue;
    m[1].split(",").forEach((s) => {
      const name = s.trim().split(/\s+as\s+/)[0].trim();
      if (name && name[0] === name[0].toUpperCase()) fileImports.add(name);
    });
  }

  for (const iconName of fileImports) {
    if (!known.has(iconName)) continue;
    const tagRegex = new RegExp("<" + iconName + "\\b", "g");
    const neonWrap = new RegExp('<NeonIcon name="' + iconName + '"', "g");
    const totalTags = (c.match(tagRegex) || []).length;
    const wrappedTags = (c.match(neonWrap) || []).length;

    if (wrappedTags < totalTags) {
      const key = iconName;
      if (!resultMap.has(key)) resultMap.set(key, []);
      resultMap.get(key).push({ file: filePath.replace(/\\/g, "/").replace("src/", ""), missing: totalTags - wrappedTags });
    }
  }
});

console.log("Unwrapped Lucide icons found:");
if (resultMap.size === 0) {
  console.log("  NONE — all icons are wrapped!\n");
} else {
  for (const [name, instances] of [...resultMap.entries()].sort()) {
    const totalMissing = instances.reduce((s, i) => s + i.missing, 0);
    console.log(`  ${name}: ${totalMissing} unwrapped in ${instances.length} files`);
    instances.forEach((i) => console.log(`    ${i.file} (${i.missing}x missing)`));
  }
}
