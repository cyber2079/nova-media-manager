import { useRef, useCallback, useLayoutEffect } from "react";

/** Place as LAST child of scrollable container. No flash: invisible until overflow confirmed. */
export default function ScrollFade({ height = 48 }: { height?: number }) {
  const fadeRef = useRef<HTMLDivElement>(null);
  const everHadOverflow = useRef(false);

  const check = useCallback(() => {
    const el = fadeRef.current?.parentElement;
    if (!el) return;
    const overflow = el.scrollHeight - el.clientHeight;
    if (overflow <= 1) {
      // Only hide if we've never confirmed overflow — otherwise keep current opacity
      if (!everHadOverflow.current) {
        fadeRef.current!.style.opacity = "0";
      } else {
        // Already visible, just check if we're at bottom now
        const dist = overflow - el.scrollTop;
        const range = Math.min(200, el.clientHeight * 0.6);
        fadeRef.current!.style.opacity = String(Math.max(0, Math.min(1, dist / range)));
      }
      return;
    }
    // We HAVE overflow — confirm it so future checks won't prematurely hide
    everHadOverflow.current = true;
    const dist = overflow - el.scrollTop;
    const range = Math.min(200, el.clientHeight * 0.6);
    fadeRef.current!.style.opacity = String(Math.max(0, Math.min(1, dist / range)));
  }, []);

  useLayoutEffect(() => {
    const fade = fadeRef.current;
    if (!fade) return;
    const el = fade.parentElement;
    if (!el) return;

    el.addEventListener("scroll", check, { passive: true });

    // Check after browser layout + async content
    let raf = requestAnimationFrame(() => requestAnimationFrame(check));
    let t = setTimeout(check, 250);

    // Tab switch / route change
    const mo = new MutationObserver(() => {
      requestAnimationFrame(() => requestAnimationFrame(check));
    });
    mo.observe(el, { childList: true, subtree: true });

    return () => {
      el.removeEventListener("scroll", check);
      cancelAnimationFrame(raf);
      clearTimeout(t);
      mo.disconnect();
    };
  }, [check]);

  return (
    <div
      ref={fadeRef}
      className="sticky bottom-0 left-0 right-0 pointer-events-none z-[2] shrink-0"
      style={{
        height,
        marginTop: -height,
        opacity: 0,
        background: `linear-gradient(to bottom, transparent, color-mix(in srgb, var(--color-primary) 25%, rgba(0,0,0, calc(var(--scroll-fade-opacity, 0.3) * 0.8))))`,
      }}
    />
  );
}
