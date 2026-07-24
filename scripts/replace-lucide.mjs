// Wrap Lucide icons with NeonIcon for IconsNeon rendering on non-default themes
// Pattern:  <IconName className="h-4 w-4" />  →  <NeonIcon name="IconName" size={16}><IconName className="h-4 w-4" /></NeonIcon>
import { readFileSync, writeFileSync, readdirSync } from "fs";
import { join } from "path";

const SRC = "src";
const icons = JSON.parse(readFileSync(join(SRC, "components", "neon-icon-data.json"), "utf-8"));
const knownNames = new Set(Object.keys(icons));

function walk(dir, cb) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, cb);
    else if (e.name.endsWith(".tsx")) cb(p);
  }
}

let totalFiles = 0;
let totalIcons = 0;

walk(SRC, (filePath) => {
  let c = readFileSync(filePath, "utf-8");
  if (!c.includes("lucide-react")) return;

  // Extract imported Lucide icons
  const importedIcons = [];
  for (const line of c.split("\n")) {
    if (!line.includes("lucide-react")) continue;
    const m = line.match(/\{([^}]+)\}/);
    if (!m) continue;
    m[1].split(",").forEach((s) => {
      const name = s.trim().split(/\s+as\s+/)[0].trim();
      if (name && name[0] === name[0].toUpperCase() && knownNames.has(name)) {
        importedIcons.push(name);
      }
    });
  }
  if (importedIcons.length === 0) return;

  // Add NeonIcon import
  const importLines = c.split("\n").filter((l) => l.includes("lucide-react"));
  const lastImport = importLines[importLines.length - 1];
  const lastImportIdx = c.indexOf(lastImport) + lastImport.length;
  if (!c.includes("import NeonIcon")) {
    c = c.slice(0, lastImportIdx) + '\nimport NeonIcon from "@/components/NeonIcon";' + c.slice(lastImportIdx);
  }

  // For each icon: wrap each usage in <NeonIcon name="IconName"><IconName ... /></NeonIcon>
  for (const iconName of importedIcons) {
    // Pattern: <IconName followed by attributes
    // Self-closing: <IconName className="..." />
    // With children: <IconName className="...">content</IconName>

    // Word boundary to prevent matching Music in MusicType, Tag in TagFilterBar, etc.
    // Handle self-closing: <IconName ... />  — match everything up to />
    // [^>] not [^/>] because Tailwind classes contain / (e.g. text-amber-400/12)
    const selfClosing = new RegExp("<" + iconName + "\\b(?!-)([^>]*?)\\s*/>", "g");
    c = c.replace(selfClosing, '<NeonIcon name="' + iconName + '" size={16}><' + iconName + '$1 /></NeonIcon>');

    // Handle closing pair: <IconName ...>non-self-closing content</IconName>
    const closeTag = new RegExp("</" + iconName + ">", "g");
    const pairRegex = new RegExp("<" + iconName + "\\b(?!-)([^>]*?)>", "g");

    // For pair tags: after replacing openings, also replace closings
    // Track positions to avoid double-wrapping within our own replacements
    const pairMatches = [];
    let pairMatch;
    while ((pairMatch = pairRegex.exec(c)) !== null) {
      // Check this isn't inside a self-closing replacement (which already has NeonIcon)
      const before = c.substring(0, pairMatch.index);
      const lastNeonOpen = before.lastIndexOf('<NeonIcon name="' + iconName + '"');
      const lastNeonClose = before.lastIndexOf('</NeonIcon>');
      if (lastNeonOpen > lastNeonClose) continue; // already wrapped
      pairMatches.push(pairMatch);
    }

    // Apply pair matches in reverse order so indices don't shift
    for (let idx = pairMatches.length - 1; idx >= 0; idx--) {
      const m = pairMatches[idx];
      const before = c.substring(0, m.index);
      const after = c.substring(m.index + m[0].length);
      c = before + '<NeonIcon name="' + iconName + '" size={16}><' + iconName + m[1] + '>' + after;
    }

    // Replace closing tags
    c = c.replace(closeTag, '</' + iconName + '></NeonIcon>');
  }

  if (c !== readFileSync(filePath, "utf-8")) {
    writeFileSync(filePath, c);
    totalFiles++;
    totalIcons += importedIcons.length;
    console.log(totalFiles + ". " + filePath.replace(/\\/g, "/").replace("src/", "") + " (" + importedIcons.length + " icons)");
  }
});

console.log("\nDone: " + totalFiles + " files, " + totalIcons + " replacements");
