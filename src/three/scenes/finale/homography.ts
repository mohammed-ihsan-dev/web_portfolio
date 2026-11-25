/**
 * CSS matrix3d that maps an element's (0,0)–(w,h) rectangle onto an arbitrary
 * screen-space quad (TL, TR, BR, BL) — Heckbert's square-to-quad projective map.
 * Used to put the real HTML footer exactly on the 3D laptop display.
 */
export function rectToQuadMatrix3d(w: number, h: number, q: Float32Array | number[]): string | null {
  const [x0, y0, x1, y1, x2, y2, x3, y3] = q; // TL, TR, BR, BL
  const dx1 = x1 - x2;
  const dx2 = x3 - x2;
  const dx3 = x0 - x1 + x2 - x3;
  const dy1 = y1 - y2;
  const dy2 = y3 - y2;
  const dy3 = y0 - y1 + y2 - y3;
  const den = dx1 * dy2 - dx2 * dy1;
  if (Math.abs(den) < 1e-9) return null;
  const g = (dx3 * dy2 - dx2 * dy3) / den;
  const hh = (dx1 * dy3 - dx3 * dy1) / den;
  const a = x1 - x0 + g * x1;
  const b = x3 - x0 + hh * x3;
  const d = y1 - y0 + g * y1;
  const e = y3 - y0 + hh * y3;
  // compose with (x/w, y/h)
  const m = [a / w, d / w, 0, g / w, b / h, e / h, 0, hh / h, 0, 0, 1, 0, x0, y0, 0, 1];
  return `matrix3d(${m.map((v) => +v.toFixed(8)).join(',')})`;
}
