const TAG_PALETTE = [
  { bg: "rgba(99,102,241,0.2)", fg: "#818cf8" },
  { bg: "rgba(139,92,246,0.2)", fg: "#a78bfa" },
  { bg: "rgba(236,72,153,0.2)", fg: "#f472b6" },
  { bg: "rgba(239,68,68,0.2)", fg: "#f87171" },
  { bg: "rgba(245,158,11,0.2)", fg: "#fbbf24" },
  { bg: "rgba(16,185,129,0.2)", fg: "#34d399" },
  { bg: "rgba(6,182,212,0.2)", fg: "#22d3ee" },
  { bg: "rgba(59,130,246,0.2)", fg: "#60a5fa" },
  { bg: "rgba(249,115,22,0.2)", fg: "#fb923c" },
  { bg: "rgba(132,204,22,0.2)", fg: "#a3e635" },
];

export function tagColor(tag: string) {
  let h = 0;
  for (let i = 0; i < tag.length; i++) h = tag.charCodeAt(i) + ((h << 5) - h);
  return TAG_PALETTE[Math.abs(h) % TAG_PALETTE.length];
}
