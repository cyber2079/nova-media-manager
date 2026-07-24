// ── 数字 count-up 动画（esae-out cubic）──

import { useEffect, useRef, useState } from "react";

export function useCountUp(target: number, ms = 700): number {
  const [v, setV] = useState(0);
  const started = useRef(false);
  useEffect(() => {
    if (started.current && target === 0) { setV(0); return; }
    started.current = true;
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / ms);
      setV(Math.round(target * (1 - Math.pow(1 - p, 3)))); // ease-out cubic
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}
