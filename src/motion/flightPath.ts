/**
 * Selected Work flight path — pure functions of a row's scroll progress `f`
 * (0 → 1), shared by the WebGL director (where the character is) and the DOM
 * (how much of the project image the flight has uncovered), so the two can
 * never disagree, forwards or backwards.
 *
 * Rows alternate direction: 0 → left-to-right, 1 → right-to-left, …
 */
const clamp = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

export const flightDir = (index: number) => (index % 2 === 0 ? 1 : -1);

/** Horizontal centre of the flyer as a fraction of the viewport width (accelerating: slower in, faster out). */
export function flightX(f: number, dir: number) {
  const e = 0.6 * f + 0.4 * f * f;
  const x = -0.34 + 1.68 * e;
  return dir > 0 ? x : 1 - x;
}

/**
 * Vertical centre as a fraction of the viewport height. It mostly holds a
 * band across the screen (so the flight reads as horizontal while the page
 * scrolls under him) and leans a little toward the row's image.
 */
export function flightY(f: number, index: number, mediaCentre01: number, last: boolean) {
  const band = 0.44 + (index % 2 ? 0.04 : -0.03);
  const toward = 0.28 * (mediaCentre01 - 0.5);
  const arc = -0.075 * Math.sin(Math.PI * f);
  // the last pass dives toward the ground as he leaves the projects
  const exit = last ? 0.55 * Math.pow(Math.max(0, f - 0.45) / 0.55, 2) : 0;
  return band + toward + arc + exit;
}

/** How much of a project image is uncovered (0..1): it opens behind him, in his direction of travel. */
export function flightReveal(f: number, dir: number, rect: { left: number; right: number; width: number }, vw: number) {
  if (f <= 0) return 0;
  if (f >= 1) return 1;
  const trailing = flightX(f, dir) * vw - dir * vw * 0.06;
  const r = dir > 0 ? (trailing - rect.left) / rect.width : (rect.right - trailing) / rect.width;
  return clamp(r);
}
