// Fix nav icons: <i> + mask-image → <span> + inline SVG (WebView2 compatible)
import { readFileSync, writeFileSync } from "fs";

let c = readFileSync("src/components/Layout.tsx", "utf-8");

const svgs = {
  home:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
  movies: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>',
  images: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>',
  music:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>',
  games:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="6" y1="12" x2="10" y2="12"/><line x1="8" y1="10" x2="8" y2="14"/><line x1="15" y1="13" x2="15.01" y2="13"/><line x1="18" y1="11" x2="18.01" y2="11"/><rect x="2" y="6" width="20" height="12" rx="2"/></svg>',
};

// Replace neonIcon map with inline SVG map
c = c.replace(
  /const neonIcon: Record<string,\[string,string\]> = \{.*?\};/s,
  `const navSvgs: Record<string,{c:string,s:string}> = {home:{c:"neon-magenta",s:"${svgs.home}"},movies:{c:"neon-cyan",s:"${svgs.movies}"},images:{c:"neon-green",s:"${svgs.images}"},music:{c:"neon-orange",s:"${svgs.music}"},games:{c:"neon-purple",s:"${svgs.games}"}};`
);

// Replace ni reference
c = c.replace(
  /const ni = neonIcon\[item\.key\] \|\| \[.*?\];/,
  "const s = navSvgs[item.key];"
);

// Replace <i> with <span> + inline SVG using dangerouslySetInnerHTML
c = c.replace(
  /<i className=\{"ni " \+ ni\[0\] \+ " " \+ ni\[1\] \+ " lg"\}><\/i>/,
  '<span className={"neon-icon " + (s?.c||"neon-cyan") + " lg"} dangerouslySetInnerHTML={{__html: s?.svg || ""}} />'
);

writeFileSync("src/components/Layout.tsx", c);
console.log("✓ navSvgs present:", c.includes("navSvgs"));
console.log("✓ dangerouslySetInnerHTML present:", c.includes("dangerouslySetInnerHTML"));
console.log("✓ neon-icon class present:", c.includes("neon-icon "));
