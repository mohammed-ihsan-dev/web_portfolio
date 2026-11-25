'use client';

/**
 * The only render loop. Runs inside the GSAP ticker (after Lenis has moved),
 * solves the director, then renders through R3F's `advance` only when
 * something is on screen. Includes adaptive resolution.
 */
import { useEffect } from 'react';
import { advance, useThree } from '@react-three/fiber';
import { experienceConfig } from '@/config/site.config';
import { addTickHook, bus } from '@/lib/scene-bus';
import { solveFrame, solved } from '../director/director';

let forced = 0;
/** Render at least `n` more frames even if nothing is visible (e.g. warm-up). */
export function requestFrames(n = 2) {
  forced = Math.max(forced, n);
}

export function FrameDriver() {
  const get = useThree((s) => s.get);

  useEffect(() => {
    const { dpr: dprCfg, frameBudget } = experienceConfig;
    const maxDpr = Math.min(window.devicePixelRatio || 1, dprCfg.max);
    let dpr = maxDpr;
    get().setDpr(dpr);

    let cleared = false;
    let renderedLast = false;
    let ema = 16.7;
    let lastCheck = performance.now();
    let goodFor = 0;
    let fpsFrames = 0;
    let fpsSince = performance.now();

    const off = addTickHook((now, dt) => {
      if (document.hidden) return;
      const state = get();
      solveFrame(state.size.width, state.size.height, dt);

      if (!(solved.any || forced > 0)) {
        if (!cleared) {
          state.gl.clear();
          cleared = true;
        }
        renderedLast = false;
        bus.debug.rendering = false;
        return;
      }
      if (forced > 0) forced--;
      advance(now / 1000);
      cleared = false;
      bus.debug.rendering = true;

      // ---- adaptive resolution (only measured across consecutive rendered frames)
      if (renderedLast) ema = ema * 0.92 + dt * 1000 * 0.08;
      renderedLast = true;
      fpsFrames++;
      if (now - fpsSince > 500) {
        bus.debug.fps = Math.round((fpsFrames * 1000) / (now - fpsSince));
        bus.debug.dpr = dpr;
        fpsFrames = 0;
        fpsSince = now;
      }
      if (now - lastCheck > 1000) {
        const elapsed = now - lastCheck;
        lastCheck = now;
        if (ema > frameBudget.degradeAbove && dpr > dprCfg.min) {
          dpr = Math.max(dprCfg.min, dpr - dprCfg.step);
          state.setDpr(dpr);
          goodFor = 0;
        } else if (ema < frameBudget.recoverBelow && dpr < maxDpr) {
          goodFor += elapsed;
          if (goodFor > 3000) {
            dpr = Math.min(maxDpr, dpr + dprCfg.step);
            state.setDpr(dpr);
            goodFor = 0;
          }
        } else {
          goodFor = 0;
        }
      }
    });
    return off;
  }, [get]);

  return null;
}
