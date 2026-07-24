// Replace nav icons in Layout.tsx with IconsNeon CSS-based rendering
import { readFileSync, writeFileSync } from "fs";

let c = readFileSync("src/components/Layout.tsx", "utf-8");

// 1. Delete navThemeIcon function (lines 59-73)
const funcStart = c.indexOf("  /**\n   * Build a theme nav icon URL");
const funcEnd = c.indexOf("export default function Layout()");
c = c.substring(0, funcStart) + c.substring(funcEnd);

// 2. Replace charIcon reference
c = c.replace(
  "const charIcon = navThemeIcon(theme, item.to);",
  'const neonClass = (["home","neon-magenta","ni-home"],["movies","neon-cyan","ni-play"],["images","neon-green","ni-image"],["music","neon-orange","ni-music"],["games","neon-purple","ni-gamepad"]).find(x=>x[0]===item.key);'
);

// 3. Replace the img div block. Find it by unique surrounding text
const imgBlockStart = c.indexOf('<div className={cn("flex h-8 w-8 shrink-0 items-center justify-center", isDefault ? "rounded-full overflow-hidden" : "rounded-lg")}>');
const restAfterImgBlock = c.substring(imgBlockStart);
// Find the closing of this div (it's 5 lines including indentation)
const lines = restAfterImgBlock.split("\n");
const divLineIdx = 0; // the opening div
let braceDepth = 0;
let endLineIdx = -1;
for (let i = divLineIdx; i < lines.length; i++) {
  const l = lines[i];
  if (l.includes("{")) braceDepth += (l.match(/\{/g)?.length || 0);
  if (l.includes("}")) braceDepth -= (l.match(/\}/g)?.length || 0);
  if (l.includes("</div>") && braceDepth <= 0) { endLineIdx = i; break; }
}
if (endLineIdx > 0) {
  const before = c.substring(0, imgBlockStart);
  const after = lines.slice(endLineIdx + 1).join("\n");
  const newBlock = '                  <div className="flex h-8 w-8 shrink-0 items-center justify-center"><i className={`${neonClass?.[2]||"ni-circle"} ${neonClass?.[1]||"neon-cyan"} lg pulse`} style={{fontSize:"24px"}}></i></div>';
  c = before + newBlock + "\n" + after;
}

writeFileSync("src/components/Layout.tsx", c);
console.log("navThemeIcon removed:", !c.includes("navThemeIcon"));
console.log("neonClass present:", c.includes("neonClass"));
console.log("ni-home present:", c.includes("ni-home"));
console.log("neon-magenta present:", c.includes("neon-magenta"));
console.log("neon-cyan present:", c.includes("neon-cyan"));
