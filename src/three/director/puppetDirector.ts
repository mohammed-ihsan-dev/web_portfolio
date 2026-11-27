/**
 * Puppet choreography — which dedicated render owns the character, where it is
 * and how it moves. Everything is a pure function of scroll (DOM rects and
 * ScrollTrigger progress); only the small living motions (breathing, typing,
 * cape flutter) read the clock.
 *
 *   hero          seated render on the finger, typing → stops → hand-over to the base pose
 *   Selected Work base pose leaps off WORK and out of frame → flies across each
 *                 project (alternating directions, turns happen off-screen) → dives out
 *   Workspace     walks in from the left (profile walk cycle) → stops at the chair →
 *                 sits (legs behind the desk) → the seated render takes over → slow push-in
 *
 * A puppet only takes over when its textures are ready; otherwise the caller
 * keeps the base-pose behaviour, so the character never vanishes.
 */
import * as THREE from 'three';
import { bus, type StationRecord } from '@/lib/scene-bus';
import { easeInOutSine, range, smoothstep } from '@/lib/math';
import { flightDir, flightX, flightY } from '@/motion/flightPath';
import { anchorOffset, getPuppet, headCentre, toLocal, type PuppetId } from '../puppet/puppets';
import { BASE_POSE, getPose } from '../character2d/poses';
import type { PuppetPose } from '../puppet/buildPuppet';
import { deskTyping, fkPoint, flight, heroClosing, heroRising, heroTyping, lowestSole, strideLength, walk } from '../puppet/clips';
import { HERO_PUPPETS, readyPuppets, requestedPuppets } from '../puppet/runtime';
import { heroLayout } from '../scenes/hero/heroLayout';

export const puppet = {
  id: null as PuppetId | null,
  /** 0..1 (hand-overs between renders fade the outgoing one while it stays on top). */
  opacity: 1,
  /** World position of the puppet's origin anchor. */
  pos: new THREE.Vector3(),
  /** In-plane bank (radians). */
  rot: 0,
  scale: 1,
  /** Mirrored (faces left). */
  flip: false,
  pose: {} as PuppetPose,
  /** Walking: the component lifts the puppet so the lowest sole sits on `pos`. */
  grounded: false,
};

/** A second render drawn UNDER `puppet` during a hand-over (fading in), or none. */
export const puppetUnder = {
  id: null as PuppetId | null,
  opacity: 1,
  pos: new THREE.Vector3(),
  rot: 0,
  scale: 1,
  flip: false,
  pose: {} as PuppetPose,
  grounded: false,
};

export const deskSet = {
  show: false,
  /** World position of the set's floor anchor (under the seated hips). */
  pos: new THREE.Vector3(),
  scale: 1,
  /** The seated render is on the chair (false = empty chair while he walks in). */
  person: false,
  /** Seated render's opacity (it fades in on top of the walker during the hand-over). */
  personOpacity: 1,
  pose: {} as PuppetPose,
};

export const ORIGIN: Record<PuppetId, string> = {
  'hero-macbook': 'seat',
  'hero-closing': 'seat',
  'hero-rising': 'seat',
  flying: 'centre',
  walking: 'feet',
  desk: 'floor',
};

const ready = (id: PuppetId) => readyPuppets.has(id);
const vTmp = new THREE.Vector3();
const vA = new THREE.Vector3();
const vB = new THREE.Vector3();

export function resetPuppetFrame() {
  puppet.id = null;
  puppet.opacity = 1;
  puppet.grounded = false;
  puppetUnder.id = null;
  puppetUnder.opacity = 1;
  deskSet.show = false;
}

/* ------------------------------------------------------------------ */
/* preloading: ask for the next scene's render before it is needed      */
/* ------------------------------------------------------------------ */
export function requestAhead(heroP: number, heroPresent: boolean, vh: number) {
  if (!heroPresent || heroP > 0.25) requestedPuppets.add('flying');
  const first = bus.flight.rows[0];
  if (first) {
    const top = first.media.getBoundingClientRect().top;
    if (top < vh * 2.2) {
      requestedPuppets.add('walking');
      requestedPuppets.add('desk');
    }
  }
}

/* ------------------------------------------------------------------ */
/* hero                                                                 */
/* ------------------------------------------------------------------ */
/**
 * Hand-over between two renders over d = 0 → 1, with no see-through moment and
 * no doubled face: the incoming render fades in UNDER the outgoing one (first
 * half) and the outgoing one then fades out on top (second half). Meanwhile both
 * slide so their faces meet at the midpoint between them: the outgoing one
 * moves there in the first half, the incoming one leaves it for its own place
 * in the second half — so the change reads as one movement.
 */
function handover(d: number, headA: THREE.Vector3, headB: THREE.Vector3, offA: THREE.Vector3, offB: THREE.Vector3) {
  vMeet.lerpVectors(headA, headB, 0.5);
  const inA = easeInOutSine(Math.min(1, d / 0.5));
  const outB = easeInOutSine(Math.max(0, (d - 0.5) / 0.5));
  offA.subVectors(vMeet, headA).multiplyScalar(inA);
  offB.subVectors(vMeet, headB).multiplyScalar(1 - outB);
  return { under: smoothstep(d / 0.5), over: 1 - smoothstep((d - 0.5) / 0.5) };
}
const vMeet = new THREE.Vector3();
const offA = new THREE.Vector3();
const offB = new THREE.Vector3();
const hA = new THREE.Vector3();
const hB = new THREE.Vector3();
const poseA: PuppetPose = {};
const poseB: PuppetPose = {};

/** World position of a hero render's face when its seat anchor is at `seat`. */
function heroHead(id: PuppetId, seat: THREE.Vector3, out: THREE.Vector3) {
  const a = getPuppet(id)!;
  const [x, y] = toLocal(a, headCentre(a), a.anchors.seat);
  return out.set(seat.x + x, seat.y + y, seat.z);
}

/** Base pose's face, relative to its hips (metres), from its own measurements. */
function baseHeadAboveHips(out: THREE.Vector3) {
  const p = getPose(BASE_POSE);
  const pelvis = p.rig?.joints.pelvis ?? p.anchors.hips ?? [0.5, 0.55];
  const crown = p.head?.crown ?? [0.5, 0];
  const chin = p.head?.chin ?? [0.5, 0.16];
  const hx = crown[0] + (chin[0] - crown[0]) * 0.6;
  const hy = crown[1] + (chin[1] - crown[1]) * 0.6;
  return out.set((hx - pelvis[0]) * p.worldWidth, (pelvis[1] - hy) * p.worldHeight, 0);
}

function place(target: typeof puppet | typeof puppetUnder, id: PuppetId, seat: THREE.Vector3, offset: THREE.Vector3, pose: PuppetPose, opacity: number) {
  target.id = id;
  target.pos.copy(seat).add(offset);
  target.rot = 0;
  target.scale = 1;
  target.flip = false;
  target.opacity = opacity;
  target.grounded = false;
  for (const k of Object.keys(target.pose)) delete target.pose[k];
  Object.assign(target.pose, pose);
}

export const heroRendersReady = () => HERO_PUPPETS.every(ready);

/**
 * Hero: seated render typing → stops → closing render → rising render → base pose.
 * Returns 'owned' while only renders show, 'overlay' while the outgoing rising
 * render still fades over the base pose (which the caller draws, faded by
 * `baseFade`), or false once the base pose owns the character.
 * `baseOffset` (out) moves the base pose's hips so its face meets the rising face.
 */
export function solveHeroPuppet(p: number, time: number, handOffset: THREE.Vector3, baseOffset: THREE.Vector3, fade: { value: number }) {
  const T = heroLayout.timeline;
  baseOffset.set(0, 0, 0);
  fade.value = 1;
  if (!heroRendersReady() || p >= T.toBase[1]) return false;
  const seat = vSeat.copy(heroLayout.puppetSeat).add(handOffset);
  offA.set(0, 0, 0);

  // living motion of each render, as pure functions of scroll + clock
  const stop = smoothstep(range(p, T.settle[0], T.settle[0] + 0.03));
  const lift = smoothstep(range(p, T.settle[0], T.toClosing[1]));
  const closingLift = smoothstep(range(p, T.toClosing[0], T.toRising[0]));
  const rise = smoothstep(range(p, T.toRising[0], T.toBase[1]));

  if (p < T.toClosing[0]) {
    place(puppet, 'hero-macbook', seat, offA, heroTyping(time, 1 - stop, lift, poseA), 1);
    return 'owned';
  }
  if (p < T.toClosing[1]) {
    const d = range(p, T.toClosing[0], T.toClosing[1]);
    const o = handover(d, heroHead('hero-macbook', seat, hA), heroHead('hero-closing', seat, hB), offA, offB);
    place(puppet, 'hero-macbook', seat, offA, heroTyping(time, 0, lift, poseA), o.over);
    place(puppetUnder, 'hero-closing', seat, offB, heroClosing(time, closingLift, poseB), o.under);
    return 'owned';
  }
  if (p < T.toRising[0]) {
    offA.set(0, 0, 0);
    place(puppet, 'hero-closing', seat, offA, heroClosing(time, closingLift, poseA), 1);
    return 'owned';
  }
  if (p < T.toRising[1]) {
    const d = range(p, T.toRising[0], T.toRising[1]);
    const o = handover(d, heroHead('hero-closing', seat, hA), heroHead('hero-rising', seat, hB), offA, offB);
    place(puppet, 'hero-closing', seat, offA, heroClosing(time, 1, poseA), o.over);
    place(puppetUnder, 'hero-rising', seat, offB, heroRising(time, rise, poseB), o.under);
    return 'owned';
  }
  if (p < T.toBase[0]) {
    offA.set(0, 0, 0);
    place(puppet, 'hero-rising', seat, offA, heroRising(time, rise, poseA), 1);
    return 'owned';
  }
  // rising render → base pose (the caller draws the base pose underneath)
  const d = range(p, T.toBase[0], T.toBase[1]);
  heroHead('hero-rising', seat, hA);
  hB.copy(heroLayout.risingHips).add(handOffset).add(baseHeadAboveHips(vTmp));
  const o = handover(d, hA, hB, offA, offB);
  place(puppet, 'hero-rising', seat, offA, heroRising(time, rise, poseA), o.over);
  baseOffset.copy(offB);
  fade.value = o.under;
  return 'overlay';
}
const vSeat = new THREE.Vector3();

/* ------------------------------------------------------------------ */
/* Selected Work: takeoff + flights                                      */
/* ------------------------------------------------------------------ */
const TAN = Math.tan((30 * Math.PI) / 360);
const CAM_Z = 10;
function screenAtDepth(x: number, y: number, D: number, vw: number, vh: number, out: THREE.Vector3) {
  return out.set(((x / vw) * 2 - 1) * D * TAN * (vw / vh), (1 - (y / vh) * 2) * D * TAN, CAM_Z - D);
}

export interface TakeoffState {
  /** 0 → 1 while he leaves WORK (crouch, launch, out the top). */
  t: number;
  /** Extra world height (metres). */
  rise: number;
}
/** Takeoff from the WORK letters once the panels have settled (only when the flight can follow). */
export function takeoff(work: StationRecord | undefined, vh: number, out: TakeoffState) {
  out.t = 0;
  out.rise = 0;
  if (!work || !ready('flying') || !bus.flight.rows.length) return out;
  const top = work.section.getBoundingClientRect().top;
  out.t = range(-top / vh, 0.1, 0.4);
  const k = range(out.t, 0.3, 1);
  out.rise = 4.6 * k * k;
  return out;
}

/** The active project flight, if any. Returns true when the flying render owns the character. */
export function solveFlight(time: number, vw: number, vh: number) {
  if (!ready('flying')) return false;
  const rows = bus.flight.rows;
  let active = -1;
  for (let i = 0; i < rows.length; i++) if (rows[i].progress > 0 && rows[i].progress < 1) active = i;
  if (active < 0) return false;
  const row = rows[active];
  const f = row.progress;
  const dir = flightDir(active);
  const last = active === rows.length - 1;
  const asset = getPuppet('flying')!;
  const rect = row.media.getBoundingClientRect();
  const centre01 = (rect.top + rect.height / 2) / vh;

  // depth: the figure spans ~32 % of the viewport width, a little closer mid-pass
  const widthM = asset.width * asset.metresPerPx * 0.62;
  const D0 = widthM / (0.32 * 2 * TAN * (vw / vh));
  const D = D0 * (1 - 0.07 * Math.sin(Math.PI * f));
  const at = (ff: number, out: THREE.Vector3) => screenAtDepth(flightX(ff, dir) * vw, flightY(ff, active, centre01, last) * vh, D, vw, vh, out);
  at(f, puppet.pos);
  // gentle bob
  puppet.pos.y += Math.sin(time * 1.7) * 0.025;
  // bank along the path (nose follows the climb / dive)
  at(Math.max(0, f - 0.01), vA);
  at(Math.min(1, f + 0.01), vB);
  const dx = Math.abs(vB.x - vA.x) || 1e-4;
  const dy = vB.y - vA.y;
  const bank = Math.atan2(dy, dx) * 0.75 + Math.sin(time * 1.3) * 0.02;
  puppet.id = 'flying';
  puppet.flip = dir < 0;
  puppet.rot = puppet.flip ? -bank : bank;
  puppet.scale = 1;
  const speed = Math.min(1, Math.hypot(vB.x - vA.x, dy) / 0.12);
  flight(time, speed, (puppet.pose = puppet.pose || {}));
  return true;
}

/* ------------------------------------------------------------------ */
/* Workspace: walk in, sit down, the seated render, push-in              */
/* ------------------------------------------------------------------ */
/* Workspace entrance, as fractions of the station's travel window (see Workspace.tsx):
 * walk in → stop (WALK_END) → sit, head travelling to the seated head (SIT_A) →
 * hand-over to the seated render (SIT_A → SIT_END, legs already behind the desk). */
const WALK_END = 0.72;
const SIT_A = 0.86;
const SIT_END = 0.95;
const SIT_MID = (SIT_A + SIT_END) / 2;
let stride = 0;

/** True once both Workspace renders are loaded (otherwise the procedural desk + base pose stay). */
export const deskReady = () => ready('walking') && ready('desk');

/**
 * Places the photographed set on the station's floor point whenever its section
 * is on screen. `t` = station travel (seated render from SIT_END), `s` = 0 → 1
 * push-in over the rest of the sticky section.
 */
export function placeDeskSet(feet: THREE.Vector3, t: number, s: number, time: number) {
  const push = 1 + 0.32 * easeInOutSine(s);
  const [hx, hy] = anchorOffset('desk', 'floor', 'head');
  deskSet.show = true;
  deskSet.scale = push;
  // scale about his head, so the push-in closes in on him at the screen
  deskSet.pos.set(feet.x + hx - hx * push, feet.y + hy - hy * push, feet.z);
  deskSet.person = t >= SIT_A;
  deskSet.personOpacity = smoothstep(range(t, SIT_A, SIT_MID));
  deskTyping(time, (deskSet.pose = deskSet.pose || {}));
}

/**
 * The walker: in from the left, slows into the stop by the chair, sits (hips
 * drop behind the desk while his head travels to where the seated render's
 * head is). Returns false once the seated render owns him (or if not loaded).
 */
export function solveWalker(t: number, feet: THREE.Vector3, start: THREE.Vector3, time: number, shadow: { pos: THREE.Vector3; opacity: number; scale: number }) {
  if (!deskReady()) return false;
  if (!stride) stride = strideLength();
  shadow.opacity = 0;
  if (t >= SIT_END) return true;
  // fades out under the seated render in the second half of the hand-over
  puppet.opacity = 1 - smoothstep(range(t, SIT_MID, SIT_END));
  const u = range(t, 0, WALK_END);
  const w = 1 - Math.pow(1 - u, 2.1); // decelerates into the stop
  vTmp.lerpVectors(start, feet, w);
  const travelled = start.distanceTo(feet) * w;
  const phase = (travelled / stride) * Math.PI;
  const amount = 1 - smoothstep(range(u, 0.86, 1));
  const settle = smoothstep(range(t, WALK_END, SIT_A));
  const pose = (puppet.pose = puppet.pose || {});
  walk(phase, amount, settle, time, pose);

  // Sitting: bring his head to where the seated render's head is (hips drop
  // behind the desk; the legs are hidden by it).
  const walking = getPuppet('walking')!;
  const origin = walking.anchors.feet;
  const headNow = fkPoint(walking, pose, 'head', walking.anchors.head, origin);
  const [shx, shy] = anchorOffset('desk', 'floor', 'head');
  const sole = lowestSole('walking', pose, 'feet');
  const lift = -sole * (1 - settle);
  pose.root = {
    x: (shx - headNow[0]) * settle,
    y: lift + (shy - headNow[1]) * settle,
  };

  puppet.id = 'walking';
  puppet.pos.copy(vTmp);
  // (opacity set above)
  puppet.rot = 0;
  puppet.scale = 1;
  puppet.flip = false;
  puppet.grounded = false;

  shadow.pos.copy(vTmp);
  shadow.opacity = 0.34 * (1 - settle);
  shadow.scale = 0.75;
  return true;
}
