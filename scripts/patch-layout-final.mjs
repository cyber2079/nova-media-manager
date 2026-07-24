// Final Layout.tsx fix for IconsNeon nav icons
import { readFileSync, writeFileSync } from "fs";

let c = readFileSync("src/components/Layout.tsx", "utf-8");

// Verify clean state
if (!c.includes("function navThemeIcon")) throw new Error("navThemeIcon not found");
if (!c.includes('export default function Layout()')) throw new Error("Layout not found");
if (!c.includes('const charIcon = navThemeIcon')) throw new Error("charIcon not found");

// Step 1: Replace navThemeIcon function + old theme maps with neonIcon map
// Find range from "Build a theme nav icon URL" comment to "export default function Layout()"
const rangeStart = c.indexOf("Build a theme nav icon URL");
const rangeEnd = c.indexOf("export default function Layout()");
if (rangeStart < 0 || rangeEnd < 0) throw new Error("Range not found: start=" + rangeStart + " end=" + rangeEnd);
// Extend backwards to beginning of comment line
let rs = rangeStart;
while (rs > 0 && c[rs] !== '\n') rs--;

const neonMap = `  const neonIcon: Record<string,[string,string]> = {home:["ni-home","neon-magenta"],movies:["ni-play","neon-cyan"],images:["ni-image","neon-green"],music:["ni-music","neon-orange"],games:["ni-gamepad","neon-purple"]};

`;
c = c.substring(0, rs) + neonMap + c.substring(rangeEnd);

// Step 2: Replace charIcon reference
c = c.replace(
  "const charIcon = navThemeIcon(theme, item.to);\n",
  ""
);

// Step 3: Replace the icon div block
// We need to find the exact text that starts with '<div className={cn("flex h-8 w-8 shrink-0'
// and ends with the matching </div>
const blockMarker = 'flex h-8 w-8 shrink-0 items-center justify-center';
const blockStart = c.indexOf(blockMarker);
if (blockStart < 0) throw new Error("Icon block not found: " + blockMarker);

// Find the opening <div containing this text
let divStart = c.lastIndexOf("<div", blockStart);
// Skip back to line start
while (divStart > 0 && c[divStart - 1] !== '\n') divStart--;

// Find matching </div>
let depth = 0;
let divEnd = -1;
for (let i = divStart; i < c.length; i++) {
  const ch = c[i];
  if (ch === '<') {
    if (c.substring(i, i + 6) === '</div>') {
      if (depth === 0) { divEnd = i + 6; break; }
      depth--;
    } else if (c[i + 1] === 'd' && c[i + 2] === 'i' && c[i + 3] === 'v') {
      depth++;
    }
  }
}
if (divEnd < 0) throw new Error("No matching </div> found");

// Build replacement JSX
const newBlock = `                  <div className="flex h-8 w-8 shrink-0 items-center justify-center">
                    {isDefault ? <item.icon className="h-5 w-5" /> : <i className={ni[0] + " " + ni[1] + " lg pulse neon-pulse-anim"}></i>}
                  </div>
`;

c = c.substring(0, divStart) + newBlock + c.substring(divEnd);

// Step 4: Verify critical strings
const checks = [
  ["navThemeIcon removed", !c.includes("navThemeIcon")],
  ["neonIcon present", c.includes("neonIcon: Record")],
  ["ni-home present", c.includes("ni-home")],
  ["ni[0] present", c.includes("ni[0]")],
  ["charIcon removed", !c.includes("charIcon")],
  ["export default Layout kept", c.includes("export default function Layout()")],
  ["import { useLocation } kept", c.includes("import { useState")],
];

let allOk = true;
for (const [msg, ok] of checks) {
  console.log(ok ? "✓" : "✗", msg);
  if (!ok) allOk = false;
}

if (allOk) {
  writeFileSync("src/components/Layout.tsx", c);
  console.log("\nWritten to src/components/Layout.tsx ✓");
} else {
  console.log("\nNOT written — checks failed");
}
