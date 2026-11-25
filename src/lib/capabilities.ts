import { DESKTOP_QUERY, experienceConfig } from '@/config/site.config';

export type ExperienceMode = 'pending' | 'mobile' | 'desktop-static' | 'desktop-3d';

/** Query overrides for testing: ?webgl=0 forces the static desktop fallback. */
function override(name: string): string | null {
  try {
    return new URLSearchParams(window.location.search).get(name);
  } catch {
    return null;
  }
}

export function isDesktopLayout() {
  return window.matchMedia(DESKTOP_QUERY).matches;
}

export function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches || override('motion') === '0';
}

let webglCache: boolean | null = null;
export function supportsWebGL2(): boolean {
  if (webglCache !== null) return webglCache;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2', { failIfMajorPerformanceCaveat: true });
    webglCache = Boolean(gl);
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    webglCache = false;
  }
  return webglCache;
}

interface NavigatorHints {
  deviceMemory?: number;
  connection?: { saveData?: boolean };
}

/* Runtime downgrade (WebGL error, context loss): the provider re-evaluates. */
let forcedReason: string | null = null;
const forcedListeners = new Set<() => void>();
export function forceStatic(reason: string) {
  if (forcedReason) return;
  forcedReason = reason;
  console.warn(`[experience] falling back to the static desktop layout: ${reason}`);
  forcedListeners.forEach((fn) => fn());
}
export function onForceStatic(fn: () => void) {
  forcedListeners.add(fn);
  return () => {
    forcedListeners.delete(fn);
  };
}

/** Decide which experience this device gets. Cheap; safe to call on resize. */
export function detectMode(): { mode: ExperienceMode; reason: string } {
  if (!isDesktopLayout()) return { mode: 'mobile', reason: 'viewport or touch-first device' };
  if (forcedReason) return { mode: 'desktop-static', reason: forcedReason };
  if (override('webgl') === '0') return { mode: 'desktop-static', reason: 'forced by ?webgl=0' };
  if (prefersReducedMotion()) return { mode: 'desktop-static', reason: 'prefers-reduced-motion' };

  const nav = navigator as Navigator & NavigatorHints;
  if (experienceConfig.respectSaveData && nav.connection?.saveData) return { mode: 'desktop-static', reason: 'save-data' };
  if ((nav.hardwareConcurrency ?? 8) < experienceConfig.minCores) return { mode: 'desktop-static', reason: 'low core count' };
  if ((nav.deviceMemory ?? 8) < experienceConfig.minMemoryGB) return { mode: 'desktop-static', reason: 'low device memory' };
  if (!supportsWebGL2()) return { mode: 'desktop-static', reason: 'WebGL2 unavailable' };
  return { mode: 'desktop-3d', reason: 'capable desktop' };
}
