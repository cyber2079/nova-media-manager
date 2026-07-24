// Final Layout.tsx fix — line-based approach
import { readFileSync, writeFileSync } from "fs";

let lines = readFileSync("src/components/Layout.tsx", "utf-8").split("\n");

// Find the comment line that starts the navThemeIcon function
const commentIdx = lines.findIndex(l => l.includes("Build a theme nav icon URL"));
const layoutIdx = lines.findIndex(l => l.includes("export default function Layout()"));

console.log("commentIdx:", commentIdx, "layoutIdx:", layoutIdx);

if (commentIdx < 0 || layoutIdx < 0) process.exit(1);

// Delete lines from commentIdx-1 to layoutIdx-1, insert neonIcon map
const before = lines.slice(0, commentIdx - 1); // everything before the comment
const after = lines.slice(layoutIdx);           // everything from Layout() onward
const insert = [
  '  const neonIcon: Record<string,[string,string]> = {home:["ni-home","neon-magenta"],movies:["ni-play","neon-cyan"],images:["ni-image","neon-green"],music:["ni-music","neon-orange"],games:["ni-gamepad","neon-purple"]};',
  '',
];

lines = [...before, ...insert, ...after];

// Find charIcon line
const charIconIdx = lines.findIndex(l => l.includes("const charIcon = navThemeIcon"));
console.log("charIconIdx:", charIconIdx);
if (charIconIdx > 0) {
  lines.splice(charIconIdx, 1); // remove the line
  // Insert ni = neonIcon after "return ("
  for (let i = charIconIdx; i < Math.min(charIconIdx + 5, lines.length); i++) {
    if (lines[i].includes("return (")) {
      lines.splice(i + 1, 0, '              const ni = neonIcon[item.key] || ["ni-circle","neon-cyan"];');
      console.log("inserted ni after line", i);
      break;
    }
  }
}

// Find and replace the icon div block
let iconDivStart = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("flex h-8 w-8 shrink-0 items-center justify-center")) {
    iconDivStart = i;
    break;
  }
}
console.log("iconDivStart:", iconDivStart);

if (iconDivStart > 0) {
  // Find the matching </div> — it's the line after <item.icon>
  let iconDivEnd = -1;
  for (let i = iconDivStart; i < Math.min(iconDivStart + 10, lines.length); i++) {
    if (lines[i].includes("</div>") && i > iconDivStart + 2) {
      iconDivEnd = i;
      break;
    }
  }
  console.log("iconDivEnd:", iconDivEnd);

  if (iconDivEnd > 0) {
    const repl = [
      '                  <div className="flex h-8 w-8 shrink-0 items-center justify-center">',
      '                    {isDefault ? <item.icon className="h-5 w-5" /> : <i className={ni[0] + " " + ni[1] + " lg pulse neon-pulse-anim"}></i>}',
      '                  </div>',
    ];
    lines.splice(iconDivStart, iconDivEnd - iconDivStart + 1, ...repl);
  }
}

let c = lines.join("\n");

// Verify
const checks = {
  "navThemeIcon removed": !c.includes("navThemeIcon"),
  "neonIcon present": c.includes("neonIcon: Record"),
  "ni-home present": c.includes("ni-home"),
  "ni[0] present": c.includes("ni[0]"),
  "charIcon removed": !c.includes("charIcon"),
  "Layout() kept": c.includes("export default function Layout()"),
  "import useState kept": c.includes("import { useState"),
};

let allOk = true;
for (const [msg, ok] of Object.entries(checks)) {
  console.log(ok ? "✓" : "✗", msg);
  if (!ok) allOk = false;
}

if (allOk) {
  writeFileSync("src/components/Layout.tsx", c);
  console.log("\n✓ Written successfully");
} else {
  console.log("\n✗ NOT written — some checks failed");
}
