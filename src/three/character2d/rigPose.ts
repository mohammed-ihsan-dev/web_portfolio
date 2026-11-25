/**
 * Rig pose = a handful of numbers that drive the 2D skeleton of an image pose.
 * Everything is plain data so the choreography can blend poses as pure
 * functions of scroll progress (deterministic forwards and backwards).
 *
 * Large limb angles are deliberately avoided on the single base image: past
 * ~0.3 rad the sleeve/torso seam shows. Big gestures need their own pose image.
 *
 * Conventions (screen space, character faces the camera):
 *   L = the arm/leg on screen-left, R = screen-right.
 *   arm/thigh "out" angles are radians AWAY from the body (positive = outward).
 *   *Scale values foreshorten a limb along its length (1 = as photographed).
 *   The head is never scaled: every parent scale is compensated, so the face
 *   is only ever translated and rotated, never stretched.
 */
export interface RigPose {
  breathe: number;
  lean: number;
  hipShift: number;
  headTilt: number;
  headX: number;
  headY: number;
  bodyScaleY: number;
  armOutL: number;
  armOutR: number;
  foreOutL: number;
  foreOutR: number;
  upperScaleL: number;
  upperScaleR: number;
  foreScaleL: number;
  foreScaleR: number;
  thighOutL: number;
  thighOutR: number;
  shinInL: number;
  shinInR: number;
  thighScaleL: number;
  thighScaleR: number;
  shinScaleL: number;
  shinScaleR: number;
}

const KEYS: (keyof RigPose)[] = [
  'breathe', 'lean', 'hipShift', 'headTilt', 'headX', 'headY', 'bodyScaleY',
  'armOutL', 'armOutR', 'foreOutL', 'foreOutR', 'upperScaleL', 'upperScaleR', 'foreScaleL', 'foreScaleR',
  'thighOutL', 'thighOutR', 'shinInL', 'shinInR', 'thighScaleL', 'thighScaleR', 'shinScaleL', 'shinScaleR',
];

export const STAND: Readonly<RigPose> = Object.freeze({
  breathe: 0, lean: 0, hipShift: 0, headTilt: 0, headX: 0, headY: 0, bodyScaleY: 1,
  armOutL: 0, armOutR: 0, foreOutL: 0, foreOutR: 0, upperScaleL: 1, upperScaleR: 1, foreScaleL: 1, foreScaleR: 1,
  thighOutL: 0, thighOutR: 0, shinInL: 0, shinInR: 0, thighScaleL: 1, thighScaleR: 1, shinScaleL: 1, shinScaleR: 1,
});

const preset = (p: Partial<RigPose>): Readonly<RigPose> => Object.freeze({ ...STAND, ...p });

/**
 * Seated on a ledge, seen from the front, typing on a laptop on the lap.
 * Thighs point at the camera, so they are foreshortened; forearms reach toward
 * the camera too. The 3D laptop lid hides the hands and the compressed lap.
 */
export const SEATED_TYPING = preset({
  bodyScaleY: 0.985,
  headY: -0.012,
  headTilt: 0.02,
  armOutL: -0.1, armOutR: -0.1,
  upperScaleL: 0.9, upperScaleR: 0.9,
  foreOutL: -0.62, foreOutR: -0.62,
  foreScaleL: 0.52, foreScaleR: 0.52,
  // knees apart, lower legs angled in and tucked back under the edge
  thighOutL: 0.17, thighOutR: 0.15,
  thighScaleL: 0.2, thighScaleR: 0.2,
  shinInL: 0.13, shinInR: 0.11,
  shinScaleL: 0.8, shinScaleR: 0.82,
});

/** Seated, hands on knees, about to push up. */
export const PREP_STAND = preset({
  bodyScaleY: 0.955,
  headY: -0.02,
  armOutL: -0.04, armOutR: -0.04,
  upperScaleL: 0.88, upperScaleR: 0.88,
  foreOutL: -0.18, foreOutR: -0.18,
  foreScaleL: 0.7, foreScaleR: 0.7,
  thighOutL: 0.08, thighOutR: 0.08,
  thighScaleL: 0.32, thighScaleR: 0.32,
  shinInL: 0.04, shinInR: 0.04,
});

/** Jump anticipation: knees bend and open, arms swing slightly out. */
export const CROUCH = preset({
  bodyScaleY: 0.965,
  headY: -0.01,
  armOutL: 0.14, armOutR: 0.14,
  foreOutL: 0.08, foreOutR: 0.08,
  thighOutL: 0.11, thighOutR: 0.11,
  shinInL: 0.09, shinInR: 0.09,
  thighScaleL: 0.74, thighScaleR: 0.74,
  shinScaleL: 0.92, shinScaleR: 0.92,
});

/** Take-off: full extension, arms rising. */
export const LAUNCH = preset({
  bodyScaleY: 1.025,
  headTilt: -0.02,
  armOutL: 0.2, armOutR: 0.2,
  foreOutL: 0.12, foreOutR: 0.12,
  thighOutL: 0.02, thighOutR: 0.02,
});

/** Airborne tuck, arms out for balance (one knee higher). */
export const AIR = preset({
  bodyScaleY: 1,
  headTilt: 0.03,
  armOutL: 0.3, armOutR: 0.27,
  foreOutL: 0.16, foreOutR: 0.18,
  thighOutL: 0.12, thighOutR: 0.08,
  shinInL: 0.16, shinInR: 0.12,
  thighScaleL: 0.5, thighScaleR: 0.62,
  shinScaleL: 0.78, shinScaleR: 0.84,
});

/** Touch-down squash. */
export const LAND = preset({
  bodyScaleY: 0.96,
  headY: -0.012,
  armOutL: 0.18, armOutR: 0.18,
  foreOutL: 0.14, foreOutR: 0.14,
  thighOutL: 0.12, thighOutR: 0.12,
  shinInL: 0.1, shinInR: 0.1,
  thighScaleL: 0.62, thighScaleR: 0.62,
  shinScaleL: 0.86, shinScaleR: 0.86,
});

/** Small presenting gesture (screen-right arm lifts toward the content). */
/** Both arms opening outward, palms toward the panels (kept within the safe angle range). */
export const PRESENT_BOTH = preset({ armOutL: 0.3, armOutR: 0.3, foreOutL: 0.26, foreOutR: 0.26, bodyScaleY: 1.01, headTilt: 0.015 });

export const PRESENT = preset({ armOutR: 0.24, foreOutR: 0.22, headTilt: -0.025, headX: 0.006, lean: -0.012 });

export function createRigPose(): RigPose {
  return { ...STAND };
}

export function copyRigPose(src: Readonly<RigPose>, out: RigPose) {
  for (const k of KEYS) out[k] = src[k];
  return out;
}

export function mixRigPose(a: Readonly<RigPose>, b: Readonly<RigPose>, t: number, out: RigPose) {
  for (const k of KEYS) out[k] = a[k] + (b[k] - a[k]) * t;
  return out;
}

/** Piecewise blend through a list of [progress, pose] keys (progress ascending). */
export function sampleKeys(keys: readonly (readonly [number, Readonly<RigPose>])[], p: number, ease: (t: number) => number, out: RigPose) {
  if (p <= keys[0][0]) return copyRigPose(keys[0][1], out);
  for (let i = 1; i < keys.length; i++) {
    if (p <= keys[i][0]) {
      const [p0, a] = keys[i - 1];
      const [p1, b] = keys[i];
      return mixRigPose(a, b, ease((p - p0) / Math.max(1e-6, p1 - p0)), out);
    }
  }
  return copyRigPose(keys[keys.length - 1][1], out);
}

/**
 * Living layer added on top of any pose: breathing, a slow weight shift, a
 * little sway in the arms, and a head that drifts toward a look target.
 * `amount` fades it out during big actions (jumps).
 */
export function addIdle(out: RigPose, time: number, amount: number, lookX = 0, lookY = 0) {
  if (amount <= 0) return out;
  const b = Math.sin(time * Math.PI * 2 * 0.24);
  out.breathe += b * amount;
  out.hipShift += Math.sin(time * 0.33) * 0.006 * amount;
  out.lean += Math.sin(time * 0.27 + 1.3) * 0.01 * amount;
  out.armOutL += (Math.sin(time * 0.6 + 0.4) * 0.012 + b * 0.006) * amount;
  out.armOutR += (Math.sin(time * 0.55 + 2.1) * 0.012 + b * 0.006) * amount;
  out.headTilt += (Math.sin(time * 0.41 + 0.7) * 0.012 - lookX * 0.035) * amount;
  out.headX += lookX * 0.01 * amount;
  out.headY += (b * 0.0015 + lookY * 0.004) * amount;
  return out;
}

/** Typing: tiny alternating forearm motion and a slow nod. Mostly hidden by the laptop lid. */
export function addTyping(out: RigPose, time: number, amount: number) {
  if (amount <= 0) return out;
  out.foreOutL += Math.sin(time * 13.0) * 0.025 * amount;
  out.foreOutR += Math.sin(time * 11.0 + 1.7) * 0.025 * amount;
  out.headY += Math.sin(time * 1.4) * 0.002 * amount;
  out.headTilt += Math.sin(time * 0.9) * 0.008 * amount;
  return out;
}
