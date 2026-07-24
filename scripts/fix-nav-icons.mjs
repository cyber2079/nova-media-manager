// Replace nav icons with IconsNeon CSS-based rendering
import { readFileSync, writeFileSync } from "fs";

let c = readFileSync("src/components/Layout.tsx", "utf-8");

// 1. Replace the navThemeIcon function body with IconsNeon constants
const oldFunc = /(\s+\/\*\*[\s\S]*?\*\/\s+function navThemeIcon\(theme: string, path: string\): string \{[\s\S]*?\n\s+\})/;
const newFunc = `  // IconsNeon native icon names + CSS glow classes per route
  const navNeonIcon: Record<string,string> = {home:"ni-home", movies:"ni-play", images:"ni-image", music:"ni-music", games:"ni-gamepad"};
  const navNeonColor: Record<string,string> = {home:"neon-magenta", movies:"neon-cyan", images:"neon-green", music:"neon-orange", games:"neon-purple"};`;

c = c.replace(oldFunc, newFunc);

// 2. Replace the img-based icon JSX with IconsNeon <i> elements
const oldIcon = /const charIcon = navThemeIcon\(item\.to\);\s+return \([^]*?<div className=\{cn\("flex h-8 w-8 shrink-0 items-center justify-center", isDefault \? "rounded-full overflow-hidden" : "rounded-lg"\)\}>[^]*?<\/div>/;
const nwIcon = `return (
                <NavLink key={item.to} to={item.to} className={cn(
                  "flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium transition-all duration-300 active:scale-95",
                  isActive ? "bg-primary/15 text-primary-light " : "text-[#b8d0e8] hover:bg-primary/10 hover:text-primary-light ",
                )}
                onClick={() => {
                  // 导航切换时，确保目标页面是可见的
                  const key = item.to === "/" ? "home" : item.to.replace("/", "");
                  const s = useSettingsStore.getState();
                  if (s.contentMinimized[key]) {
                    s.toggleContentMinimized(key);
                  }
                }}>
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center">
                    <i className={\`\${navNeonIcon[item.key] || 'ni-circle'} \${navNeonColor[item.key] || 'neon-cyan'} lg pulse\`} style={{fontSize:'24px'}}></i>
                  </div>`;

c = c.replace(oldIcon, nwIcon);

// 3. Remove unused import
c = c.replace('import { ThemeAssets, themeUrl } from "@/lib/themeBase";', 'import { ThemeAssets } from "@/lib/themeBase";');

writeFileSync("src/components/Layout.tsx", c);
console.log("Done. navNeonIcon present:", c.includes("navNeonIcon"));
console.log("neon-magenta present:", c.includes("neon-magenta"));
console.log("ni-home present:", c.includes("ni-home"));
