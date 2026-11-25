'use client';

/**
 * Decides, per device, which experience runs:
 *   mobile          — lightweight layout, no WebGL, no GSAP/Lenis download
 *   desktop-static  — editorial desktop layout, static character, no WebGL
 *   desktop-3d      — full cinematic runtime (motion + shared canvas), lazy-loaded
 *
 * The pre-paint script in <head> already set `data-experience` for CSS; this
 * provider confirms it (WebGL check) and mounts the desktop runtime chunk.
 */
import { type ComponentType, createContext, use, useEffect, useState, useSyncExternalStore } from 'react';
import { DESKTOP_QUERY } from '@/config/site.config';
import { detectMode, onForceStatic, type ExperienceMode } from '@/lib/capabilities';

const ExperienceContext = createContext<ExperienceMode>('pending');
export const useExperienceMode = () => use(ExperienceContext);

let cached: ExperienceMode | null = null;
function subscribe(onChange: () => void) {
  const queries = [window.matchMedia(DESKTOP_QUERY), window.matchMedia('(prefers-reduced-motion: reduce)')];
  const handler = () => {
    cached = null;
    onChange();
  };
  queries.forEach((q) => q.addEventListener('change', handler));
  const offForced = onForceStatic(handler);
  return () => {
    queries.forEach((q) => q.removeEventListener('change', handler));
    offForced();
  };
}
function getSnapshot(): ExperienceMode {
  if (cached === null) cached = detectMode().mode;
  return cached;
}
const getServerSnapshot = (): ExperienceMode => 'pending';

export function ExperienceProvider({ children }: { children: React.ReactNode }) {
  const mode = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [Runtime, setRuntime] = useState<ComponentType | null>(null);

  // Plain dynamic import (not next/dynamic, which emits a preload link on every
  // device): the motion + WebGL chunks are requested only after the capability check.
  useEffect(() => {
    if (mode !== 'desktop-3d') return;
    let cancelled = false;
    import('@/components/desktop/DesktopRuntime').then((m) => {
      if (!cancelled) setRuntime(() => m.default);
    });
    return () => {
      cancelled = true;
    };
  }, [mode]);

  useEffect(() => {
    if (mode === 'pending') return;
    const html = document.documentElement;
    html.setAttribute('data-experience', mode);
    if (mode !== 'desktop-3d') {
      html.classList.remove('is-preloading');
      html.removeAttribute('data-scene');
    }
  }, [mode]);

  return (
    <ExperienceContext value={mode}>
      {children}
      {mode === 'desktop-3d' && Runtime && <Runtime />}
    </ExperienceContext>
  );
}
