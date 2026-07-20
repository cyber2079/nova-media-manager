// Ice Girl background video — A/B roll with configurable loop parameters.
// Extracted from Layout.tsx to keep the component under ~600 lines.

import { useEffect, useRef } from "react";
import { useSettingsStore } from "@/stores/settingsStore";

export function useIceBackgroundVideo(isActive: boolean) {
  const iceVidRef = useRef<HTMLVideoElement>(null);
  const iceVidBRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const vidA = iceVidRef.current;
    const vidB = iceVidBRef.current;
    if (!vidA || !vidB) return;

    let canvas: HTMLCanvasElement | null = null;
    let ctx: CanvasRenderingContext2D | null = null;
    let raf = 0;
    let active: HTMLVideoElement;
    let chaser: HTMLVideoElement;
    let snap: HTMLCanvasElement | null = null;
    let switching = false;
    let blendF = 0;
    let blendFrames = 27;
    let loopCount = 0;
    let firstPlayDone = false;
    let loopEndTimeout: ReturnType<typeof setTimeout> | null = null;

    const getCfg = () => useSettingsStore.getState().bgVideoLoop;
    const readCfg = () => { const c = getCfg(); blendFrames = Math.max(1, Math.round(c.transitionMs / (1000 / 60))); };
    readCfg();

    let resizeTimer: ReturnType<typeof setTimeout>;
    const resize = () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (!canvas) return;
        const w = window.innerWidth, h = window.innerHeight;
        canvas.width = w; canvas.height = h;
        if (snap) { snap.width = w; snap.height = h; }
      }, 150);
    };

    const nextLoopTime = (vid: HTMLVideoElement): number => {
      const c = getCfg();
      const dur = vid.duration || 30;
      let t = c.loopStart;
      if (c.loopDuration > 0 && t + c.loopDuration < dur) t = Math.min(t, dur - c.loopDuration);
      return Math.max(0, Math.min(t, dur - 0.1));
    };

    const capSnapshot = () => {
      if (!canvas) return;
      if (!snap) snap = document.createElement('canvas');
      snap.width = canvas.width; snap.height = canvas.height;
      snap.getContext('2d')!.drawImage(canvas, 0, 0);
    };

    const scheduleLoopEnd = (vid: HTMLVideoElement) => {
      if (loopEndTimeout) clearTimeout(loopEndTimeout);
      const c = getCfg();
      if (c.loopDuration <= 0) return;
      loopEndTimeout = setTimeout(() => { readCfg(); if (loopCount !== 1) doSwitch(); }, c.loopDuration * 1000);
    };

    const doSwitch = () => {
      const c = getCfg(); readCfg();
      if (!firstPlayDone) { firstPlayDone = true; if (c.loopCount === 1) return; }
      else { if (c.loopCount > 0) { loopCount--; if (loopCount <= 0) return; } }
      capSnapshot(); switching = true; blendF = 0;
      const old = active; active = chaser; chaser = old; chaser.pause();
      if (firstPlayDone) chaser.currentTime = nextLoopTime(chaser);
      requestAnimationFrame(() => { active.play().catch(() => {}); scheduleLoopEnd(active); });
    };

    const setup = () => {
      const c = getCfg(); readCfg();
      canvas = document.createElement('canvas');
      canvas.className = 'ice-bg-video';
      canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;object-fit:cover;z-index:0;';
      vidA.parentNode?.insertBefore(canvas, vidA);
      vidA.style.opacity = '0'; vidA.style.pointerEvents = 'none';
      vidB.style.opacity = '0'; vidB.style.pointerEvents = 'none';
      ctx = canvas.getContext('2d')!;
      resize();
      window.addEventListener('resize', resize);
      const rate = c.playbackRate;
      vidA.playbackRate = rate; vidB.playbackRate = rate;
      active = vidA; chaser = vidB; loopCount = c.loopCount;
      if (c.firstPlayStart > 0 && vidA.duration > c.firstPlayStart) {
        vidA.currentTime = c.firstPlayStart;
        if (c.firstPlayEnd > c.firstPlayStart)
          setTimeout(() => doSwitch(), (c.firstPlayEnd - c.firstPlayStart) * 1000);
      }
      chaser.currentTime = nextLoopTime(chaser);
      scheduleLoopEnd(active);
    };

    const draw = () => {
      if (!ctx || !canvas) return;
      const w = canvas.width, h = canvas.height;
      const mode = useSettingsStore.getState().bgVideoMode || "fill";
      const isPortrait = h > w;
      const hasVideoDims = active.videoWidth > 0 && active.videoHeight > 0;
      let dx = 0, dy = 0, dw = w, dh = h;
      let needsBg = false;
      if (mode === "stretch") { dx = 0; dy = 0; dw = w; dh = h; }
      else if (mode === "fill") {
        if (hasVideoDims) {
          const vw = active.videoWidth, vh = active.videoHeight;
          const scale = Math.max(w / vw, h / vh);
          const sw = vw * scale, sh = vh * scale;
          dx = (w - sw) / 2; dy = (h - sh) / 2; dw = sw; dh = sh;
        }
      } else {
        if (isPortrait && hasVideoDims) {
          const vw = active.videoWidth, vh = active.videoHeight;
          const scale = Math.min(w / vw, h / vh);
          dw = vw * scale; dh = vh * scale;
          dx = (w - dw) / 2; dy = (h - dh) / 2; needsBg = true;
        }
      }
      if (needsBg) {
        ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--color-surface').trim() || '#0f172a';
        ctx.fillRect(0, 0, w, h);
      }
      if (switching) {
        blendF++;
        const alpha = Math.min(1, blendF / blendFrames);
        if (alpha >= 1) switching = false;
        if (snap) { ctx.globalAlpha = 1; ctx.drawImage(snap, 0, 0, w, h); }
        if (alpha > 0.005) { ctx.globalAlpha = alpha; ctx.drawImage(active, dx, dy, dw, dh); ctx.globalAlpha = 1; }
      } else { ctx.drawImage(active, dx, dy, dw, dh); }
      raf = requestAnimationFrame(draw);
    };

    const onEnded = () => { doSwitch(); };

    const unsub = useSettingsStore.subscribe((s, prev) => {
      if (s.bgVideoLoop.playbackRate !== prev.bgVideoLoop.playbackRate) {
        vidA.playbackRate = s.bgVideoLoop.playbackRate;
        vidB.playbackRate = s.bgVideoLoop.playbackRate;
      }
    });

    if (vidA.readyState >= 1) { setup(); draw(); }
    else vidA.addEventListener('loadedmetadata', () => { setup(); draw(); }, { once: true });
    vidA.addEventListener('ended', onEnded);
    vidB.addEventListener('ended', onEnded);

    return () => {
      cancelAnimationFrame(raf);
      if (loopEndTimeout) clearTimeout(loopEndTimeout);
      unsub();
      vidA.removeEventListener('ended', onEnded);
      vidB.removeEventListener('ended', onEnded);
      window.removeEventListener('resize', resize);
      canvas?.remove();
      vidA.style.opacity = ''; vidA.style.pointerEvents = '';
      vidB.style.opacity = ''; vidB.style.pointerEvents = '';
    };
  }, [isActive]);

  return { iceVidRef, iceVidBRef };
}
