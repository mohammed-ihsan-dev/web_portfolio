/**
 * Puppet clips: pure functions (time or scroll phase → bone pose). Nothing here
 * keeps state, so scrolling backwards replays exactly.
 *
 * Angles: radians, counter-clockwise on screen. For the right-facing walker a
 * positive thigh rotation swings the foot forward.
 */
import type { PuppetPose } from './buildPuppet';
import { getPuppet, type PuppetAsset } from './puppets';

const DEG = Math.PI / 180;
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (t: number) => {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
};

/* ------------------------------------------------------------------------ */
/* 2D forward kinematics on the manifest's bone pivots (no three.js needed)  */
/* ------------------------------------------------------------------------ */
type M2 = { a: number; b: number; c: number; d: number; tx: number; ty: number };
const I2: M2 = { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 };
const mul = (m: M2, n: M2): M2 => ({
  a: m.a * n.a + m.c * n.b,
  b: m.b * n.a + m.d * n.b,
  c: m.a * n.c + m.c * n.d,
  d: m.b * n.c + m.d * n.d,
  tx: m.a * n.tx + m.c * n.ty + m.tx,
  ty: m.b * n.tx + m.d * n.ty + m.ty,
});

/** Position (metres, origin = anchor, y up) of a source-px point carried by `bone` under `pose`. */
export function fkPoint(p: PuppetAsset, pose: PuppetPose, bone: string, src: [number, number], origin: [number, number]) {
  const m = p.metresPerPx;
  const L = ([x, y]: [number, number]) => [(x - origin[0]) * m, (origin[1] - y) * m];
  const chain: string[] = [];
  for (let b: string | null = bone; b; b = p.bones[b]?.parent ?? null) chain.unshift(b);
  let M = I2;
  let parentPivot = [0, 0];
  for (const b of chain) {
    const [px, py] = L(p.bones[b].pivot);
    const bp = pose[b] ?? {};
    const r = bp.r ?? 0;
    const sx = bp.sx ?? 1;
    const sy = bp.sy ?? sx;
    const cos = Math.cos(r);
    const sin = Math.sin(r);
    const local: M2 = { a: cos * sx, b: sin * sx, c: -sin * sy, d: cos * sy, tx: px - parentPivot[0] + (bp.x ?? 0), ty: py - parentPivot[1] + (bp.y ?? 0) };
    M = mul(M, local);
    parentPivot = [px, py];
  }
  const [qx, qy] = L(src);
  const lx = qx - parentPivot[0];
  const ly = qy - parentPivot[1];
  return [M.a * lx + M.c * ly + M.tx, M.b * lx + M.d * ly + M.ty] as const;
}

/* ------------------------------------------------------------------------ */
/* Hero: seated on the finger, typing on the MacBook                         */
/* ------------------------------------------------------------------------ */
/**
 * @param typing 1 = typing, 0 = hands resting
 * @param lift   0 → 1 "stops working": hands come off the keys, head and chest rise a little
 */
export function heroTyping(time: number, typing: number, lift: number, out: PuppetPose) {
  const breath = Math.sin(time * Math.PI * 2 * 0.24);
  // irregular key rhythm: three incommensurate frequencies, clipped so it reads as taps
  const tap = Math.max(0, Math.sin(time * 11.3) * 0.6 + Math.sin(time * 17.9 + 1.3) * 0.4 + Math.sin(time * 6.1 + 0.4) * 0.3);
  out.root = {};
  out.spine = { r: Math.sin(time * 0.31) * 0.004 + lift * 0.01, sy: 1 + lift * 0.006 };
  out.chest = { r: Math.sin(time * 0.43 + 0.8) * 0.003 + Math.sin(time * 1.7) * 0.0025 * typing, sy: 1 + breath * 0.006, sx: 1 + breath * 0.003 };
  out.head = {
    // the eyes stay on the screen: small nods and drift toward it, never a turn to the viewer
    r: Math.sin(time * 0.52) * 0.01 + Math.sin(time * 1.31 + 0.5) * 0.004 * typing - lift * 0.035,
    y: (Math.sin(time * 1.1) * 0.0012 + lift * 0.006) * 1,
    x: -lift * 0.004,
  };
  out.hand = {
    y: tap * 0.0045 * typing + lift * 0.02,
    x: Math.sin(time * 2.3) * 0.002 * typing - lift * 0.004,
    r: Math.sin(time * 9.7 + 0.6) * 0.02 * typing + lift * 0.08,
  };
  return out;
}

/** Closing render: hands settle on the shut lid, head and eyes lift (`lift` 0 → 1). */
export function heroClosing(time: number, lift: number, out: PuppetPose) {
  const breath = Math.sin(time * Math.PI * 2 * 0.24);
  const press = Math.sin(Math.PI * Math.min(1, lift * 1.4)) * 0.004;
  out.root = {};
  out.chest = { r: Math.sin(time * 0.4) * 0.003, sy: 1 + breath * 0.005, sx: 1 + breath * 0.0025 };
  // the head comes up from a slightly lowered tilt (it was looking at the screen)
  out.head = { r: (1 - lift) * 0.045 + Math.sin(time * 0.5) * 0.006, y: -(1 - lift) * 0.008 };
  out.handL = { y: -press };
  out.handR = { y: -press * 0.8 };
  return out;
}

/** Rising render: weight comes forward and up (`rise` 0 → 1). */
export function heroRising(time: number, rise: number, out: PuppetPose) {
  const breath = Math.sin(time * Math.PI * 2 * 0.3);
  out.root = { y: rise * 0.03, r: -rise * 0.015 };
  out.chest = { r: rise * 0.01 + Math.sin(time * 0.6) * 0.003, sy: 1 + breath * 0.004 };
  out.head = { r: Math.sin(time * 0.45) * 0.006 - rise * 0.012 };
  return out;
}

/* ------------------------------------------------------------------------ */
/* Flight                                                                    */
/* ------------------------------------------------------------------------ */
/** Cape flutter, a gentle leg kick, the head and the leading arm; `speed` 0..1 scales the flutter. */
export function flight(time: number, speed: number, out: PuppetPose) {
  const w = Math.PI * 2 * (1.1 + speed * 0.9);
  const amp = 0.4 + speed * 0.6;
  out.root = {};
  out.cape1 = { r: Math.sin(time * w) * 0.015 * amp };
  out.cape2 = { r: Math.sin(time * w - 0.9) * 0.04 * amp };
  out.cape3 = { r: Math.sin(time * w - 1.8) * 0.07 * amp };
  out.cape4 = { r: Math.sin(time * w - 2.7) * 0.1 * amp };
  out.legs = { r: Math.sin(time * 2.1) * 0.035 + Math.sin(time * 5.3) * 0.01 * speed };
  out.head = { r: Math.sin(time * 0.7) * 0.012 };
  out.armF = { r: Math.sin(time * 0.9 + 1) * 0.012 };
  out.armB = { r: Math.sin(time * 1.3 + 2) * 0.02 };
  return out;
}

/* ------------------------------------------------------------------------ */
/* Walk (profile, facing right)                                              */
/* ------------------------------------------------------------------------ */
// Thigh angles as photographed (from vertical, + = forward): near (back) leg −18°, far (front) +24.5°.
const THIGH_SWING = 21.25 * DEG; // half the angle between them: legs swap over half a cycle
const KNEE_SWING = 34 * DEG;
// Kept modest: the near arm covers the torso side in the render; a wide back-swing would uncover
// more painted (hidden) hoodie than reads well.
const ARM_SWING = 10 * DEG;

/** Stride length (metres) = distance between the photographed ankles. */
export function strideLength() {
  const p = getPuppet('walking');
  if (!p) return 0.7;
  return (p.bones.fAnkle.pivot[0] - p.bones.nAnkle.pivot[0]) * p.metresPerPx;
}

/**
 * @param phase radians; 0 = the photographed pose, π = legs swapped. Drive it
 *              from distance travelled (π per stride) so feet do not slide.
 * @param amount 0 → 1 blends from standing still to full gait.
 * @param settle 0 → 1 prepares to sit: torso leans forward, near arm reaches.
 */
export function walk(phase: number, amount: number, settle: number, time: number, out: PuppetPose) {
  const k = 1 - Math.cos(phase); // 0 at the photographed pose, 2 when swapped
  const swingN = Math.max(0, Math.sin(phase)); // near leg travelling forward
  const swingF = Math.max(0, -Math.sin(phase));
  const a = amount;
  // standing still: legs come together under the hips
  const still = 1 - a;
  const nThigh = THIGH_SWING * k * a + 18 * DEG * still;
  const fThigh = -THIGH_SWING * k * a - 24.5 * DEG * still;
  const nKnee = -KNEE_SWING * Math.pow(swingN, 1.4) * a;
  const fKnee = -KNEE_SWING * Math.pow(swingF, 1.4) * a + 6 * DEG * still;
  out.root = {};
  out.nHip = { r: nThigh };
  out.nKnee = { r: nKnee };
  out.nAnkle = { r: -(nThigh + nKnee) * 0.55 };
  out.fHip = { r: fThigh };
  out.fKnee = { r: fKnee };
  out.fAnkle = { r: -(fThigh + fKnee) * 0.55 };
  // arms counter-swing; the near arm photographed forward swings back
  const arm = ARM_SWING * k * a;
  out.nShoulder = { r: -arm + settle * 0.42 + 6 * DEG * still };
  out.nElbow = { r: -arm * 0.45 + settle * 0.3 - 10 * DEG * still };
  out.nWrist = { r: settle * 0.1 };
  out.fShoulder = { r: arm - 6 * DEG * still };
  out.fElbow = { r: arm * 0.7 };
  // torso: a little forward lean while walking, more when about to sit; slight counter-rotation
  out.chest = { r: -0.025 * a - settle * 0.16 + Math.sin(phase * 2) * 0.006 * a };
  out.head = { r: settle * 0.05 + Math.sin(time * 0.6) * 0.008 + Math.sin(phase * 2 + 0.5) * 0.004 * a };
  return out;
}

const SOLES: Record<string, [string, [number, number]][]> = {
  walking: [
    ['nAnkle', [366, 928]],
    ['nAnkle', [502, 936]],
    ['fAnkle', [776, 930]],
    ['fAnkle', [928, 900]],
  ],
};
/** Height (metres) of the lowest sole above the anchor under `pose` (negative = below). */
export function lowestSole(id: 'walking', pose: PuppetPose, originAnchor: string) {
  const p = getPuppet(id);
  if (!p) return 0;
  const origin = p.anchors[originAnchor];
  let min = Infinity;
  for (const [bone, pt] of SOLES[id]) min = Math.min(min, fkPoint(p, pose, bone, pt, origin)[1]);
  return min;
}

/* ------------------------------------------------------------------------ */
/* Desk: seated typing at the monitor                                        */
/* ------------------------------------------------------------------------ */
export function deskTyping(time: number, out: PuppetPose) {
  const breath = Math.sin(time * Math.PI * 2 * 0.22);
  const tapL = Math.max(0, Math.sin(time * 12.7) * 0.7 + Math.sin(time * 7.3 + 0.9) * 0.4);
  const tapR = Math.max(0, Math.sin(time * 10.9 + 2.1) * 0.7 + Math.sin(time * 15.1) * 0.35);
  out.root = {};
  out.chest = { r: Math.sin(time * 0.37) * 0.004, sy: 1 + breath * 0.005, sx: 1 + breath * 0.0025 };
  out.head = { r: Math.sin(time * 0.48 + 0.3) * 0.008 + Math.sin(time * 1.9) * 0.003, y: Math.sin(time * 1.2) * 0.0008 };
  out.handL = { y: tapL * 0.0035, r: Math.sin(time * 8.9) * 0.015 };
  out.handR = { y: tapR * 0.0035, r: Math.sin(time * 9.6 + 1.1) * 0.015 };
  return out;
}

export { smooth as clipSmooth };
