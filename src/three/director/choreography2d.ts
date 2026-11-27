/**
 * Image-character choreography: pure functions of scroll progress (and a
 * clock for the living layer) that output which pose image to show, its rig
 * pose, how it is anchored (feet vs hips), the targets and the ground shadow.
 *
 * Dedicated pose images are preferred when they exist (pickPose). Otherwise
 * the base pose is driven through synthesised presets (seated foreshortening,
 * crouch → launch → tuck → land), which is honest about being one image.
 */
import * as THREE from 'three';
import { easeInOutCubic, easeInOutSine, range, smoothstep } from '@/lib/math';
import { BASE_POSE, baseLegLength, pickPose, type PoseId } from '../character2d/poses';
import {
  AIR,
  CROUCH,
  LAND,
  LAUNCH,
  PRESENT,
  SEATED_TYPING,
  STAND,
  addIdle,
  addTyping,
  copyRigPose,
  sampleKeys,
  type RigPose,
} from '../character2d/rigPose';
import { heroLayout } from '../scenes/hero/heroLayout';

/* ---------- extra presets used only here ---------- */
const SEATED_REST: RigPose = { ...SEATED_TYPING, armOutL: -0.05, armOutR: -0.05, foreOutL: -0.3, foreOutR: -0.3, foreScaleL: 0.74, foreScaleR: 0.74 };
const RISE: RigPose = { ...STAND, bodyScaleY: 0.97, thighScaleL: 0.66, thighScaleR: 0.66, thighOutL: 0.07, thighOutR: 0.07, shinInL: 0.05, shinInR: 0.05, armOutL: 0.05, armOutR: 0.05 };
const REACH: RigPose = { ...STAND, armOutL: 0.2, armOutR: 0.2, foreOutL: 0.12, foreOutR: 0.12, bodyScaleY: 1.01 };

export interface ImageFrame {
  want: PoseId;
  rig: RigPose;
  overlay: RigPose;
  /** 0 = feet on `feet`, 1 = hips on `hips`. */
  anchor: number;
  feet: THREE.Vector3;
  hips: THREE.Vector3;
  shadow: { pos: THREE.Vector3; opacity: number; scale: number };
}

export function createImageFrame(): ImageFrame {
  return {
    want: BASE_POSE,
    rig: { ...STAND },
    overlay: { ...STAND },
    anchor: 0,
    feet: new THREE.Vector3(),
    hips: new THREE.Vector3(),
    shadow: { pos: new THREE.Vector3(), opacity: 0, scale: 1 },
  };
}

/** Half-risen from the finger (the seated render hands over to the base pose here). */
const RISE0: RigPose = { ...RISE, bodyScaleY: 0.965, thighScaleL: 0.6, thighScaleR: 0.6, thighOutL: 0.08, thighOutR: 0.08, shinInL: 0.06, shinInR: 0.06, armOutR: 0.14, foreOutR: 0.1, headY: -0.008 };
/** Rising while the right hand sets the closed MacBook down on the palm. */
const RISE_ASIDE: RigPose = { ...RISE, armOutR: 0.2, foreOutR: 0.06, upperScaleR: 0.95, headTilt: -0.02 };

const HERO_KEYS = (() => {
  const T = heroLayout.timeline;
  const [l0, l1] = T.leap;
  const span = l1 - l0;
  return [
    [0, RISE0],
    [T.toBase[0], RISE0],
    [(T.aside[0] + T.aside[1]) / 2, RISE_ASIDE],
    [T.stand[1], STAND],
    [T.crouch[1], CROUCH],
    [l0 + span * 0.12, LAUNCH],
    [l0 + span * 0.27, AIR],
    [l0 + span * 0.76, AIR],
    [l0 + span * 0.9, REACH],
    [l1, LAND],
    [T.recover[1], STAND],
  ] as const;
})();

const vTmp = new THREE.Vector3();
const vStand = new THREE.Vector3();
const ZERO = new THREE.Vector3();

/**
 * Hero, base-pose half: the hero renders (seated → closing → rising) own the
 * character until `T.toBase`; from there the rigged base pose finishes standing
 * up (the MacBook in his hand is set on the palm), stands, crouches, leaps and lands on the station
 * `landingFeet` (already in world space).
 */
export function heroFrame(p: number, time: number, handOffset: THREE.Vector3, landingFeet: THREE.Vector3, out: ImageFrame, baseOffset: THREE.Vector3 = ZERO) {
  const T = heroLayout.timeline;
  const leg = baseLegLength();

  sampleKeys(HERO_KEYS, p, easeInOutSine, out.rig);
  const jumping = p > T.crouch[0] && p < T.recover[0];
  addIdle(out.rig, time, jumping ? 0.12 : p < T.stand[1] ? 0.6 : 1);
  copyRigPose(STAND, out.overlay);
  addIdle(out.overlay, time, jumping ? 0.1 : 0.8);

  // At the hand-over the hips are where the render's hips were, already lifting off the finger.
  // At the hand-over the hips are where the rising render's hips are.
  const seatHips = vTmp.copy(heroLayout.risingHips).add(handOffset).add(baseOffset);
  const standFeet = vStand.copy(heroLayout.standFeet).add(handOffset);
  out.feet.copy(standFeet);
  const [l0, l1] = T.leap;
  const span = l1 - l0;
  const tt = range(p, l0, l1);

  if (p < l0) {
    // Rising off the finger → standing in the palm.
    out.anchor = 1 - smoothstep(range(p, T.toBase[0], T.stand[1] - 0.01));
    out.hips.copy(seatHips);
  } else {
    // Ballistic hop: feet ease across, arc up; hips lead while airborne.
    const along = easeInOutCubic(tt);
    out.feet.lerpVectors(standFeet, landingFeet, along);
    out.feet.y += Math.sin(Math.PI * tt) * heroLayout.leapHeight;
    out.anchor = range(p, l0, l0 + span * 0.12) * (1 - range(p, l1 - span * 0.12, l1));
    out.hips.copy(out.feet).y += leg * 0.94;
  }

  /* shadow on whatever is underneath */
  const s = out.shadow;
  if (p < l0) {
    s.pos.copy(heroLayout.standFeet).add(handOffset);
    // Seated on a finger: no floor under him, so the contact shadow appears as he stands.
    s.opacity = 0.42 * (1 - out.anchor);
    s.scale = 1.1 - 0.25 * (1 - out.anchor);
  } else {
    s.pos.lerpVectors(standFeet, landingFeet, easeInOutCubic(tt));
    const air = Math.sin(Math.PI * tt);
    s.opacity = 0.42 * (1 - 0.85 * air);
    s.scale = 0.85 * (1 - 0.5 * air);
  }

  /* dedicated pose images, when they exist */
  if (p < l0) out.want = pickPose(['03-preparing-to-stand']);
  else if (tt > 0.12 && tt < 0.88) out.want = pickPose(['04-jumping', '09-superhero-jump']);
  else if (tt >= 0.88 && p < T.recover[1]) out.want = pickPose(['07-landing']);
  else out.want = pickPose(['08-confident-standing']);
  return out;
}

const TAKEOFF_KEYS = [
  [0, STAND],
  [0.22, CROUCH],
  [0.32, LAUNCH],
  [0.46, AIR],
  [1, AIR],
] as const;

/** Selected Work: leaves the WORK letters — crouch, launch, and straight up out of frame. */
export function takeoffFrame(t: number, time: number, feet: THREE.Vector3, rise: number, out: ImageFrame) {
  const leg = baseLegLength();
  sampleKeys(TAKEOFF_KEYS, t, easeInOutSine, out.rig);
  addIdle(out.rig, time, 0.15);
  copyRigPose(STAND, out.overlay);
  addIdle(out.overlay, time, 0.1);
  out.feet.copy(feet);
  out.feet.y += rise;
  out.anchor = range(t, 0.28, 0.36);
  out.hips.copy(out.feet).y += leg * 0.94;
  const air = range(t, 0.3, 0.6);
  out.shadow.pos.copy(feet);
  out.shadow.opacity = 0.36 * (1 - air);
  out.shadow.scale = 0.85 * (1 - 0.5 * air);
  out.want = t > 0.3 ? pickPose(['04-jumping', '09-superhero-jump']) : BASE_POSE;
  return out;
}

const TRAVEL_KEYS = [
  [0, STAND],
  [0.07, CROUCH],
  [0.13, LAUNCH],
  [0.21, AIR],
  [0.79, AIR],
  [0.88, REACH],
  [0.94, LAND],
  [1, STAND],
] as const;

/** Between stations: a scroll-scrubbed hop (anticipation, arc, landing). */
export function travelFrame(t: number, time: number, fromFeet: THREE.Vector3, toFeet: THREE.Vector3, out: ImageFrame) {
  const leg = baseLegLength();
  sampleKeys(TRAVEL_KEYS, t, easeInOutSine, out.rig);
  addIdle(out.rig, time, 0.12);
  copyRigPose(STAND, out.overlay);
  addIdle(out.overlay, time, 0.1);
  const a = range(t, 0.1, 0.9);
  const dist = fromFeet.distanceTo(toFeet);
  out.feet.lerpVectors(fromFeet, toFeet, easeInOutCubic(a));
  out.feet.y += Math.sin(Math.PI * a) * Math.min(1.1, 0.35 + dist * 0.18);
  out.anchor = range(t, 0.1, 0.15) * (1 - range(t, 0.85, 0.9));
  out.hips.copy(out.feet).y += leg * 0.94;
  const air = Math.sin(Math.PI * a);
  out.shadow.pos.lerpVectors(fromFeet, toFeet, easeInOutCubic(a));
  out.shadow.opacity = 0.38 * (1 - 0.85 * air);
  out.shadow.scale = 0.85 * (1 - 0.5 * air);
  out.want = a > 0.05 && a < 0.95 ? pickPose(['04-jumping']) : BASE_POSE;
  return out;
}

/**
 * Parked at a station. `sinceArrival` (seconds) drives one-shot gestures;
 * seated stations sit on the edge (hips on the surface, legs hanging).
 */
export function stationFrame(
  state: string,
  arrive: string | null,
  seated: boolean,
  sinceArrival: number,
  time: number,
  feet: THREE.Vector3,
  look: THREE.Vector2,
  lookWeight: number,
  out: ImageFrame,
  /** Hip joint height above `feet` when seated: ~0.12 on a ledge, ~0.56 on a chair. */
  hipsLift = 0.12,
) {
  const typing = seated && state === 'typing';
  copyRigPose(typing ? SEATED_TYPING : seated ? SEATED_REST : STAND, out.rig);
  if (typing) addTyping(out.rig, time, 1);
  // Gentle presenting / greeting gestures for the base pose (big gestures need their own pose images).
  const gesture = arrive === 'wave' || arrive === 'point' || state === 'point' ? Math.max(0, 1 - Math.max(0, sinceArrival - 2.2) / 0.8) * smoothstep(sinceArrival / 0.6) : 0;
  if (gesture > 0) {
    for (const k of Object.keys(PRESENT) as (keyof RigPose)[]) out.rig[k] += (PRESENT[k] - STAND[k]) * gesture;
    if (arrive === 'wave') out.rig.foreOutR += Math.sin(sinceArrival * 9) * 0.12 * gesture;
  }
  addIdle(out.rig, time, 1, look.x * lookWeight, look.y * lookWeight);
  copyRigPose(STAND, out.overlay);
  addIdle(out.overlay, time, 0.9, look.x * lookWeight, look.y * lookWeight);

  out.feet.copy(feet);
  out.anchor = seated ? 1 : 0;
  out.hips.copy(feet).y += hipsLift;
  out.shadow.pos.copy(feet);
  out.shadow.opacity = seated && hipsLift < 0.3 ? 0 : 0.36;
  out.shadow.scale = 0.85;

  if (typing) out.want = pickPose(['06-desktop-working']);
  else if (arrive === 'wave' && sinceArrival < 3) out.want = pickPose(['12-waving']);
  else if (state === 'point' || arrive === 'point') out.want = pickPose(['10-presenting-work']);
  else if (seated) out.want = BASE_POSE;
  else out.want = pickPose(['08-confident-standing']);
  return out;
}

/**
 * Between stations on foot. The image faces the camera, so this is a frontal
 * gait: alternating knee lift (foreshortened thigh/shin), hip sway, counter
 * arm swing, a small bob. The stride phase comes from distance travelled, so it
 * scrubs forwards and backwards with scroll.
 */
export function walkFrame(t: number, time: number, fromFeet: THREE.Vector3, toFeet: THREE.Vector3, out: ImageFrame) {
  const e = easeInOutSine(t);
  out.feet.lerpVectors(fromFeet, toFeet, e);
  const travelled = fromFeet.distanceTo(toFeet) * e;
  const phase = (travelled / 0.36) * Math.PI;
  const sw = Math.sin(phase);
  const amp = smoothstep(range(t, 0, 0.08)) * (1 - smoothstep(range(t, 0.88, 1)));
  const liftL = Math.max(0, sw) * amp;
  const liftR = Math.max(0, -sw) * amp;
  copyRigPose(STAND, out.rig);
  out.rig.thighScaleL = 1 - 0.13 * liftL;
  out.rig.thighScaleR = 1 - 0.13 * liftR;
  out.rig.shinScaleL = 1 - 0.07 * liftL;
  out.rig.shinScaleR = 1 - 0.07 * liftR;
  out.rig.shinInL = 0.04 * liftL;
  out.rig.shinInR = 0.04 * liftR;
  out.rig.hipShift = 0.012 * sw * amp;
  out.rig.lean = -0.012 * sw * amp;
  out.rig.armOutL = 0.035 + 0.05 * liftR;
  out.rig.armOutR = 0.035 + 0.05 * liftL;
  out.rig.foreOutL = 0.03 * liftR;
  out.rig.foreOutR = 0.03 * liftL;
  out.rig.headY = -0.004 * Math.abs(Math.cos(phase)) * amp;
  addIdle(out.rig, time, 0.4);
  copyRigPose(out.rig, out.overlay);
  out.feet.y += 0.012 * Math.abs(sw) * amp;
  out.anchor = 0;
  out.hips.copy(out.feet).y += baseLegLength();
  out.shadow.pos.lerpVectors(fromFeet, toFeet, e);
  out.shadow.opacity = 0.36;
  out.shadow.scale = 0.85;
  out.want = BASE_POSE;
  return out;
}
