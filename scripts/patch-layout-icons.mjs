import { readFileSync, writeFileSync } from "fs";

let c = readFileSync("src/components/Layout.tsx", "utf-8");

// 1. Add neonIcon map after the navItems array
const insertPoint = 'const noIcons: Record<string,string> = {};';
const neonMap = '  const neonIcon: Record<string,[string,string]> = {home:["ni-home","neon-magenta"],movies:["ni-play","neon-cyan"],images:["ni-image","neon-green"],music:["ni-music","neon-orange"],games:["ni-gamepad","neon-purple"]};\n  const noIcons: Record<string,string> = {};';
c = c.replace(insertPoint, neonMap);

// 2. Replace charIcon reference
c = c.replace('const charIcon = navThemeIcon(theme, item.to);', 'const ni = neonIcon[item.key] || ["ni-circle","neon-cyan"];');

// 3. Replace the img div block
const oldBlockStart = '<div className={cn("flex h-8 w-8 shrink-0 items-center justify-center", isDefault ? "rounded-full overflow-hidden" : "rounded-lg")}>';
const idx = c.indexOf(oldBlockStart);
const afterIdx = c.substring(idx);

// Find matching </div>
let depth = 0;
let closePos = -1;
for (let i = oldBlockStart.length; i < afterIdx.length; i++) {
  if (afterIdx.substring(i, i+1) === '<') {
    if (afterIdx.substring(i, i+6) === '</div>') {
      if (depth === 0) { closePos = idx + i + 6; break; }
      depth--;
    } else if (afterIdx.substring(i, i+4) === '<div') {
      depth++;
    }
  }
}

if (closePos > 0) {
  const newBlock = '<div className="flex h-8 w-8 shrink-0 items-center justify-center">{isDefault ? <item.icon className="h-5 w-5" /> : <i className={`${ni[0]} ${ni[1]} lg`}></i>}</div>';
  c = c.substring(0, idx) + newBlock + c.substring(closePos);
}

// 4. Delete navThemeIcon function + old ice/cg maps
const delStart = c.indexOf('  // Ice Girl nav icons');
const delEnd = c.indexOf('  export default function Layout()');
c = c.substring(0, delStart) + c.substring(delEnd + 2);

writeFileSync("src/components/Layout.tsx", c);

console.log("neonIcon:", c.includes("neonIcon"));
console.log("ni-home:", c.includes("ni-home"));
console.log("neon-magenta:", c.includes("neon-magenta"));
console.log("navThemeIcon removed:", !c.includes("navThemeIcon"));
