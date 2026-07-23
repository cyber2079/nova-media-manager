// Render IconsNeon SVGs as WebP with baked neon colors + SVG glow filter
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const sharp = require("sharp");

const iconsSrc = readFileSync("D:/nova-themes-assets/cyberpunk/IconsNeon-main/icons.js", "utf-8");
const icons = eval(iconsSrc.substring(iconsSrc.indexOf("["), iconsSrc.lastIndexOf("]") + 1));

const needed = [
  { k: "home",  n: "home",    c: "#ff005d" },
  { k: "movie", n: "play",    c: "#00fff9" },
  { k: "pic",   n: "image",   c: "#00ff9e" },
  { k: "music", n: "music",   c: "#ffaa00" },
  { k: "game",  n: "gamepad", c: "#bf00ff" },
  { k: "logo",  n: "cpu",     c: "#ff005d" },
];
const OUT = "D:/nova-themes-assets/cyberpunk/nav-icons";

// Build a complete, valid SVG string with the icon + optional glow
function buildSvg(iconSvg, colorHex, withGlow) {
  // The iconSvg from icons.js is: <svg viewBox="0 0 24 24" ...><path .../></svg>
  // We need to extract the inner content and wrap it properly
  const innerMatch = iconSvg.match(/<svg[^>]*>([\s\S]*)<\/svg>/);
  const innerContent = innerMatch ? innerMatch[1].trim() : iconSvg;

  // Replace currentColor with the hex
  const content = innerContent.replace(/stroke="currentColor"/g, `stroke="${colorHex}"`);

  if (withGlow) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 24 24">
  <defs>
    <filter id="glow" x="-150%" y="-150%" width="400%" height="400%">
      <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur1"/>
      <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur2"/>
      <feMerge>
        <feMergeNode in="blur2"/>
        <feMergeNode in="blur1"/>
        <feMergeNode in="blur1"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
  <rect width="24" height="24" fill="transparent"/>
  <g stroke="${colorHex}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"
     filter="url(#glow)" opacity="0.7">${content}</g>
  <g stroke="${colorHex}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none">${content}</g>
</svg>`;
  } else {
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 24 24">
  <rect width="24" height="24" fill="transparent"/>
  <g stroke="${colorHex}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"
     opacity="0.55">${content}</g>
</svg>`;
  }
}

async function main() {
  for (const item of needed) {
    const iconData = icons.find(o => o.name === item.n);
    if (!iconData) { console.log("NOT FOUND:", item.n); continue; }

    const svgActive = buildSvg(iconData.svg, item.c, true);
    const svgNormal = buildSvg(iconData.svg, item.c, false);

    await sharp(Buffer.from(svgActive))
      .resize(256, 256, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .webp({ lossless: true })
      .toFile(join(OUT, item.k + "-active.webp"));

    await sharp(Buffer.from(svgNormal))
      .resize(256, 256, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .webp({ lossless: true })
      .toFile(join(OUT, item.k + ".webp"));

    console.log("OK:", item.k, item.c);
  }
  console.log("DONE — 12 icons rendered");
}

main().catch(e => { console.error(e); process.exit(1); });
