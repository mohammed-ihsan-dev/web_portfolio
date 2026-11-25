/**
 * Runtime configuration that isn't content. Breakpoints and capability rules
 * live here so CSS, the pre-paint script and the JS gate stay in agreement.
 */

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://example.com').replace(/\/$/, '');

/** Desktop layout breakpoint (px). Keep in sync with `@custom-media`-style queries in globals.css. */
export const DESKTOP_MIN_WIDTH = 1024;

/**
 * The single media query that decides desktop vs. mobile layout. Touch-first
 * devices (tablets included) get the lightweight layout even when wide.
 */
export const DESKTOP_QUERY = `(min-width: ${DESKTOP_MIN_WIDTH}px) and (hover: hover) and (pointer: fine)`;

export const experienceConfig = {
  /** Skip WebGL when the browser asks for less data. */
  respectSaveData: true,
  /** Minimum logical cores / device memory (GB) for the 3D scene. */
  minCores: 4,
  minMemoryGB: 4,
  /** Preloader never holds the page longer than this (ms). */
  preloaderMaxMs: 4500,
  /** Minimum on-screen time so the counter reads as intentional, not a flash (ms). */
  preloaderMinMs: 900,
  /** Device-pixel-ratio window for the canvas. */
  dpr: { min: 1, max: 1.75, step: 0.25 },
  /** Frame-time thresholds (ms) for adaptive resolution. */
  frameBudget: { degradeAbove: 21, recoverBelow: 13 },
} as const;
