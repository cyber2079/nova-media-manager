import { readFileSync, writeFileSync } from "fs";

let c = readFileSync("src/components/Layout.tsx", "utf-8");

// === Step 1: Delete navThemeIcon function, insert neonIcon map ===
const delStart = c.indexOf('  /**\n   * Build a theme nav icon URL');
const delEnd = c.indexOf('export default function Layout()');
const neonMap = `  const neonIcon: Record<string,[string,string]> = {home:["ni-home","neon-magenta"],movies:["ni-play","neon-cyan"],images:["ni-image","neon-green"],music:["ni-music","neon-orange"],games:["ni-gamepad","neon-purple"]};\n\n`;
c = c.substring(0, delStart) + neonMap + c.substring(delEnd);

// === Step 2: Replace nav icon rendering block ===
// Current: <div className={cn...}> {charIcon ? <img.../> : <item.icon/>} </div>
// Target:  <div>{isDefault ? <item.icon/> : <i className={\`ni ni-home neon-magenta lg\`}></i>}</div>

const oldBlock = '<div className={cn("flex h-8 w-8 shrink-0 items-center justify-center", isDefault ? "rounded-full overflow-hidden" : "rounded-lg")}>';
const oldIdx = c.indexOf(oldBlock);
if (oldIdx > 0) {
  // Find matching </div>
  let depth = 0;
  let endIdx = -1;
  for (let i = oldIdx; i < c.length; i++) {
    if (c.substring(i, i + 6) === '</div>') {
      if (depth === 0) { endIdx = i + 6; break; }
      depth--;
    } else if (c.substring(i, i + 4) === '<div') {
      depth++;
    }
  }
  if (endIdx > 0) {
    // <i> with template literal
    const newBlock = '<div className="flex h-8 w-8 shrink-0 items-center justify-center">{isDefault ? <item.icon className="h-5 w-5" /> : <i className={ni[0] + " " + ni[1] + " lg"}></i>}</div>';
    c = c.substring(0, oldIdx) + newBlock + c.substring(endIdx);
  }
}

// === Step 3: Verify ===
writeFileSync("src/components/Layout.tsx", c);

console.log("navThemeIcon removed:", !c.includes("navThemeIcon"));
console.log("neonIcon present:", c.includes("neonIcon: Record"));
console.log("ni-home present:", c.includes("ni-home"));
console.log("ni[0] present:", c.includes("ni[0]"));
