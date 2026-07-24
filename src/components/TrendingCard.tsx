// ── 热门游戏卡：图片三级降级（header → 搜索小图 → 文字卡），卡片永不消失 ──
// 此前 onError 直接 display:none 整卡，404 图连环隐藏 = "逐个被过滤"的残影观感

import { useState } from "react";
import { fmtPrice, type TrendingGame } from "@/lib/trending";

interface Props {
  g: TrendingGame;
  delay: number;
  onOpen: () => void;
  rounded?: "sm" | "lg";
  textColor?: string;
  priceColor?: string;
  nameColor?: string;
}

export default function TrendingCard({ g, delay, onOpen, rounded = "lg", textColor = "text-[#c8ddf0]", priceColor = "text-[#8aa8c4]", nameColor = "text-[#c8ddf0]" }: Props) {
  const [src, setSrc] = useState(g.image);
  const [failed, setFailed] = useState(false);
  const handleError = () => {
    if (g.logo && src !== g.logo) setSrc(g.logo);
    else setFailed(true);
  };

  const roundClass = rounded === "sm" ? "rounded-sm" : "rounded-lg";

  return (
    <button onClick={onOpen} className="shrink-0 w-40 text-left group opacity-0 animate-fade-in-up"
      style={{ animationDelay: `${delay}ms`, animationFillMode: "forwards" }}>
      <div className={`relative ${roundClass} overflow-hidden bg-surface-lighter aspect-[460/215] mb-1.5`}>
        {failed ? (
          <div className="w-full h-full flex items-center justify-center px-2"
            style={{ background: "linear-gradient(135deg, color-mix(in srgb, var(--color-primary) 25%, #101520), #101520)" }}>
            <span className="text-[11px] text-white/80 text-center leading-tight">{g.name}</span>
          </div>
        ) : (
          <img src={src} alt="" loading="lazy"
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            onError={handleError} />
        )}
        {g.discount > 0 && (
          <span className="absolute top-1 right-1 rounded bg-green-600/90 px-1.5 py-0.5 text-[10px] font-bold text-white">-{g.discount}%</span>
        )}
      </div>
      <p className={`text-[11px] ${nameColor} truncate group-hover:text-white transition-colors`}>{g.name}</p>
      {fmtPrice(g.finalPrice, g.currency) && (
        <p className={`text-[10px] ${priceColor} tabular-nums`}>{fmtPrice(g.finalPrice, g.currency)}</p>
      )}
    </button>
  );
}
