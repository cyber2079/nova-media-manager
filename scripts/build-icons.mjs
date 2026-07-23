#!/usr/bin/env node
// Rebuild cyberpunk nav icons from IconsNeon SVGs with baked theme colors
import { readFileSync } from "fs";
import { join } from "path";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const sharp = require("sharp");

const themeJson = JSON.parse(readFileSync("D:/nova-proprietary/themes/cyberpunk/theme.json", "utf-8"));
const iconsSrc = readFileSync("D:/nova-themes-assets/cyberpunk/IconsNeon-main/icons.js", "utf-8");
const icons = eval(iconsSrc.substring(iconsSrc.indexOf("["), iconsSrc.lastIndexOf("]") + 1));

const OUT = "D:/nova-themes-assets/cyberpunk/nav-icons";

function makeIcon(key, iconData, color, opacity, withGlow) {
  const strokeColor = color || "#ff005d";
  let inner = iconData.svg.replace(/stroke="currentColor"/g, `stroke="${strokeColor}"`);

  let defs = "";
  let gOpen = "";
  let gClose = "";

  if (withGlow) {
    defs = `<filter id="g" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="2"/>
      <feMerge>
        <feMergeNode/>
        <feMergeNode/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>`;
    gOpen = `<g filter="url(#g)" opacity="${opacity}">`;
    gClose = `</g>`;
  } else {
    gOpen = `<g opacity="${opacity}">`;
    gClose = `</g>`;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 24 24">
  <defs>${defs}</defs>
  <rect width="24" height="24" fill="transparent"/>
  ${gOpen}
  ${inner}
  ${gClose}
</svg>`;

  const outPath = join(OUT, key + ".webp");
  sharp(Buffer.from(svg))
    .resize(256, 256, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .webp({ lossless: true })
    .toFile(outPath)
    .then(() => console.log("  OK:", key + ".webp"))
    .catch(e => console.error("  ERR:", key, e.message));
}

console.log("Building nav icons...");

const needed = [
  { k: "home",  n: "home",    c: themeJson.nav.home.color },
  { k: "movie", n: "play",    c: themeJson.nav.movies.color },
  { k: "pic",   n: "image",   c: themeJson.nav.images.color },
  { k: "music", n: "music",   c: themeJson.nav.music.color },
  { k: "game",  n: "gamepad", c: themeJson.nav.games.color },
];

for (const x of needed) {
  const icon = icons.find(o => o.name === x.n);
  if (icon) {
    makeIcon(x.k + "-active", icon, x.c, 1.0, true);
    makeIcon(x.k, icon, x.c, 0.55, false);
  } else {
    console.log("  NOT FOUND:", x.n);
  }
}

const cpu = icons.find(o => o.name === "cpu");
if (cpu) {
  makeIcon("logo", cpu, themeJson.colors.primary, 1.0, false);
  makeIcon("logo-active", cpu, themeJson.colors.primary, 1.0, true);
}

console.log("Done. Output:", OUT);
