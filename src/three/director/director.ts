/**
 * Director — solves, once per tick and before rendering, where everything
 * should be: camera blend, hero props, character targets/pose, desk props.
 *
 * Inputs are the scene bus (scroll-driven progress written by GSAP) and live
 * station rects from the DOM. Outputs go into `solved`, which the R3F
 * components apply in useFrame. DOM reads happen here in one batch (no
 * writes), and the frame driver can skip rendering when nothing is on screen.
 *
 * Two character paths share the same targets:
 *   - rigged GLB: clip states + scrubbed clips (AnimationController)
 *   - image character: pose image + 2D rig pose + feet/hips anchoring (choreography2d)
 */
import * as THREE from 'three';
import { bus, type StationRecord } from '@/lib/scene-bus';
import { characterConfig, hasCharacterModel } from '@/config/character.config';
import { clamp, easeInOutCubic, easeOutCubic, lerp, range, smoothstep } from '@/lib/math';
import type { CharacterState, StationPose } from '@/types/character';
import { heroLayout } from '../scenes/hero/heroLayout';
import { BASE_POSE, getPose, type PoseId } from '../character2d/poses';
import { readyPoses, requestedPoses } from '../character2d/runtime';
import { PRESENT_BOTH, STAND, copyRigPose } from '../character2d/rigPose';
import { createImageFrame, heroFrame, stationFrame, takeoffFrame, travelFrame, walkFrame } from './choreography2d';
import { deskReady, deskSet, placeDeskSet, puppet, puppetUnder, requestAhead, resetPuppetFrame, solveFlight, solveHeroPuppet, solveWalker, takeoff, type TakeoffState } from './puppetDirector';

/** The page camera every station is solved against. */
export const CANON = { z: 10, fov: 30 } as const;
const TAN = Math.tan((CANON.fov * Math.PI) / 360);
const H = characterConfig.height;
const DEG = Math.PI / 180;

export interface ScrubEntry {
  state: CharacterState;
  t: number;
  w: number;
}

export const solved = {
  any: false,
  /** 0 = hero camera, 1 = canonical page camera. */
  camBlend: 1,
  hero: {
    show: false,
    p: 0,
    entrance: 1,
    lid: 1,
    /** 0 = laptop on his lap, 1 = set down on the palm. */
    laptopAside: 0,
    /** The 3D MacBook (hidden while the seated render, which has its own, is on screen). */
    laptopVisible: true,
    handsOut: 0,
    dissolve: 0,
    /** Current world offsets of the hands (entrance + exit drift). */
    lowerOffset: new THREE.Vector3(),
    upperOffset: new THREE.Vector3(),
  },
  /** Smoothed pointer parallax (hero only), written by the camera rig. */
  parallax: new THREE.Vector2(),
  character: {
    show: false,
    station: '',
    stationPose: 'stand' as StationPose,
    /** Feet target (world). */
    pos: new THREE.Vector3(),
    /** Hips target (world), used while seated or airborne. */
    hips: new THREE.Vector3(),
    /** 0 = place by feet, 1 = place by hips. */
    anchor: 0,
    /* ---- rigged GLB path ---- */
    yaw: 0,
    mode: 'play' as 'play' | 'scrub',
    state: 'idle' as CharacterState,
    oneShot: null as CharacterState | null,
    oneShotId: 0,
    scrub: [] as ScrubEntry[],
    speed: 0,
    look: new THREE.Vector2(),
    lookWeight: 0,
    onHero: false,
    /** A dedicated pose render (puppet) owns the character this frame; the base pose is not drawn. */
    owned: false,
    /** Base-pose opacity multiplier (fades in under a render during a hand-over). */
    fade: 1,
    /* ---- image path ---- */
    rig: { ...STAND },
    rigOverlay: { ...STAND },
    image: {
      current: BASE_POSE as PoseId,
      prev: null as PoseId | null,
      mix: 1,
      blend: false,
      switchAt: 0,
      smear: new THREE.Vector2(),
    },
    frames: { name: null as string | null, progress: 0 },
    shadow: { pos: new THREE.Vector3(), opacity: 0, scale: 1 },
  },
  desk: {
    show: false,
    pos: new THREE.Vector3(),
    yaw: 0,
  },
  /** Selected Work project panels flying from his hands to their links. */
  panels: {
    show: false,
    items: Array.from({ length: 4 }, () => ({ pos: new THREE.Vector3(), w: 1, h: 1, rotY: 0, rotZ: 0, opacity: 0 })),
  },
  /** Finale: MacBook opens, camera flies into the screen. `active` = it owns the camera. */
  finale: { active: false, q: 0 },
  /** Dedicated pose renders (layered puppets). When `puppet.id` is set it owns the character. */
  puppet,
  /** A second render drawn under `puppet` while one hands over to the next. */
  puppetUnder,
  /** Workspace set from the desk render (chair, desk, monitor, mug + the seated character). */
  deskSet,
};

/* ---------- scratch (no allocation per frame) ---------- */
const vA = new THREE.Vector3();
const vB = new THREE.Vector3();
const vTmp = new THREE.Vector3();
const lastFeet = new THREE.Vector3();
const frame = createImageFrame();
const prevScreen = { x: 0, y: 0, h: 0, valid: false };
let arrivedAt = '';
let arrivalTime = 0;
let clock = 0;

interface ScreenPoint {
  x: number;
  y: number;
  h: number;
}
const tk: TakeoffState = { t: 0, rise: 0 };
const baseOffset = new THREE.Vector3();
const baseFade = { value: 1 };
const sA: ScreenPoint = { x: 0, y: 0, h: 0 };
const sB: ScreenPoint = { x: 0, y: 0, h: 0 };
const sOut: ScreenPoint = { x: 0, y: 0, h: 0 };

function stationScreen(st: StationRecord, out: ScreenPoint) {
  const r = st.el.getBoundingClientRect();
  out.x = r.left + r.width / 2;
  out.y = r.bottom;
  out.h = r.height;
  return out;
}

/** Screen feet point + apparent height → world feet position at constant world scale. Returns camera distance. */
export function screenToWorld(p: ScreenPoint, vw: number, vh: number, out: THREE.Vector3) {
  const f = Math.max(p.h, 1) / vh;
  const D = H / (f * 2 * TAN);
  const ndcX = (p.x / vw) * 2 - 1;
  const ndcY = 1 - (p.y / vh) * 2;
  out.set(ndcX * D * TAN * (vw / vh), ndcY * D * TAN, CANON.z - D);
  return D;
}

/** World point → screen px under the canonical camera (for visibility tests). */
function worldToScreen(v: THREE.Vector3, vw: number, vh: number, out: ScreenPoint) {
  const D = Math.max(0.1, CANON.z - v.z);
  out.x = ((v.x / (D * TAN * (vw / vh)) + 1) / 2) * vw;
  out.y = ((1 - v.y / (D * TAN)) / 2) * vh;
  out.h = (H / (2 * D * TAN)) * vh;
  return out;
}

function heroTravel(p: number) {
  return range(p, heroLayout.timeline.leap[0], heroLayout.timeline.leap[1]);
}

/** GLB path: character clips during the hero sequence — a pure function of progress. */
function heroScrub(p: number, out: ScrubEntry[]) {
  out.length = 0;
  const T = heroLayout.timeline;
  const add = (state: CharacterState, a: number, b: number, fadeIn: number, fadeOut: number) => {
    if (p < a - fadeIn || p > b + fadeOut) return;
    const w = Math.min(range(p, a - fadeIn, a + 1e-4), 1 - range(p, b, b + fadeOut + 1e-4));
    if (w > 0.001) out.push({ state, t: range(p, a, b), w });
  };
  add('closeLaptop', T.lid[0], T.lid[1], 0.02, 0.02);
  add('standUp', T.stand[0], T.stand[1], 0.02, 0.02);
  add('jump', T.leap[0], lerp(T.leap[0], T.leap[1], 0.62), 0.02, 0.02);
  add('land', lerp(T.leap[0], T.leap[1], 0.62), T.leap[1], 0.02, 0.03);
  return out;
}

/** Selected Work: panels leave his chest and settle exactly on their DOM links. */
let panelGesture = 0;
const vSrc = new THREE.Vector3();
const PANEL_DEPTH = 6.4;
function solvePanels(vw: number, vh: number) {
  const P = solved.panels;
  P.show = false;
  panelGesture = 0;
  const slots = bus.panelSlots;
  const work = bus.stations.find((s) => s.id === 'work');
  if (!work || !slots.length) return;
  const head = work.section.getBoundingClientRect();
  if (head.bottom < 0 || head.top > vh) return;
  // Starts once he has landed (header top at 34 % of the viewport) and runs for 40 % of a screen.
  const hp = range(vh * 0.34 - head.top, 0, vh * 0.42);
  screenToWorld(stationScreen(work, sA), vw, vh, vSrc);
  vSrc.y += 1.05;
  const k = (2 * PANEL_DEPTH * TAN) / vh;
  let flying = 0;
  for (let i = 0; i < P.items.length; i++) {
    const it = P.items[i];
    const slot = slots[i];
    if (!slot) {
      it.opacity = 0;
      continue;
    }
    const r = (slot.firstElementChild as HTMLElement | null)?.getBoundingClientRect() ?? slot.getBoundingClientRect();
    const e = easeOutCubic(range(hp, i * 0.1, 0.62 + i * 0.1));
    sOut.x = r.left + r.width / 2;
    sOut.y = r.top + r.height / 2;
    vTmp.set(((sOut.x / vw) * 2 - 1) * PANEL_DEPTH * TAN * (vw / vh), (1 - (sOut.y / vh) * 2) * PANEL_DEPTH * TAN, CANON.z - PANEL_DEPTH);
    it.pos.lerpVectors(vSrc, vTmp, e);
    it.pos.y += Math.sin(Math.PI * e) * 0.35;
    it.pos.z += Math.sin(Math.PI * e) * 0.5;
    const s = lerp(0.1, 1, e);
    it.w = r.width * k * s;
    it.h = r.height * k * s;
    it.rotY = (1 - e) * (i % 2 ? -0.75 : 0.75);
    it.rotZ = (1 - e) * 0.22 * (i - 1.5);
    it.opacity = smoothstep(range(e, 0, 0.12));
    if (e > 0 && e < 1) flying = Math.max(flying, Math.sin(Math.PI * Math.min(1, e * 1.2)));
    const caption = e > 0.98 ? '1' : '0';
    if (slot.style.getPropertyValue('--panel-caption') !== caption) slot.style.setProperty('--panel-caption', caption);
    if (it.opacity > 0.01) P.show = true;
  }
  panelGesture = flying;
}

/** Look target: a [data-look] element near the centre, else the cursor. */
function solveLook(vw: number, vh: number) {
  const c = solved.character;
  for (const el of bus.lookTargets) {
    const r = el.getBoundingClientRect();
    if (r.bottom > vh * 0.2 && r.top < vh * 0.8 && r.width > 0) {
      c.look.set(((r.left + r.width / 2) / vw) * 2 - 1, 1 - ((r.top + r.height / 2) / vh) * 2);
      return;
    }
  }
  if (bus.pointer.active) c.look.set(bus.pointer.nx, bus.pointer.ny);
}

/** Pick which pose image is on screen: only ready textures, soft blend between like poses, smear-cut otherwise. */
function solveImage(want: PoseId, dt: number) {
  const img = solved.character.image;
  requestedPoses.add(want);
  const target = readyPoses.has(want) ? want : readyPoses.has(img.current) ? img.current : BASE_POSE;
  if (target !== img.current) {
    img.prev = img.current;
    img.current = target;
    img.switchAt = clock;
    img.blend = getPose(target).anchor === getPose(img.prev).anchor;
  }
  const since = clock - img.switchAt;
  img.mix = img.blend ? smoothstep(since / 0.22) : 1;
  if (img.mix >= 1) img.prev = null;
  // A short directional smear sells a hard pose cut as motion.
  const c = solved.character;
  if (!img.blend && since < 0.14 && dt > 0) {
    const asset = getPose(img.current);
    const k = (1 - since / 0.14) * 0.6;
    img.smear.set(((c.pos.x - lastFeet.x) / dt / asset.worldWidth) * k * 0.016, -((c.pos.y - lastFeet.y) / dt / asset.worldHeight) * k * 0.016);
  } else {
    img.smear.set(0, 0);
  }
}

const seatedFrame = createImageFrame();
/** Hip joint height above the station's floor point: a chair at a desk, or a ledge. */
const hipsLiftOf = (s: StationRecord) => (s.prop === 'desk' ? 0.56 : 0.12);
/** Blend the current frame toward "seated at station s" by w (rig, anchor, hips). */
function blendSeated(w: number, s: StationRecord, feet: THREE.Vector3) {
  if (w <= 0) return;
  stationFrame(s.state, null, true, 0, clock, feet, solved.character.look, 0, seatedFrame, hipsLiftOf(s));
  for (const k of Object.keys(frame.rig) as (keyof typeof frame.rig)[]) frame.rig[k] += (seatedFrame.rig[k] - frame.rig[k]) * w;
  frame.anchor += (1 - frame.anchor) * w;
  frame.hips.lerp(seatedFrame.hips, w);
  frame.feet.lerp(seatedFrame.feet, w);
  frame.shadow.opacity *= 1 - w;
}

export function solveFrame(vw: number, vh: number, dt: number) {
  clock += dt;
  const c = solved.character;
  const hero = solved.hero;
  const model = hasCharacterModel();
  const T = heroLayout.timeline;
  resetPuppetFrame();

  /* ---------- hero ---------- */
  const p = bus.hero.present ? bus.hero.progress : 1;
  hero.p = p;
  hero.entrance = bus.hero.present ? bus.hero.entrance : 1;
  hero.show = bus.hero.present && bus.hero.visible && p < 0.985;
  hero.lid = 1 - smoothstep(range(p, T.lid[0], T.lid[1]));
  hero.laptopAside = smoothstep(range(p, T.aside[0], T.aside[1]));
  hero.handsOut = easeInOutCubic(range(p, T.hands[0], T.hands[1]));
  hero.dissolve = range(p, T.sky[0], T.sky[1]);
  const ent = 1 - easeOutCubic(hero.entrance);
  hero.lowerOffset.set(...heroLayout.lowerHand.enter).multiplyScalar(ent).addScaledVector(vTmp.set(...heroLayout.lowerHand.exit), hero.handsOut);
  hero.upperOffset.set(...heroLayout.upperHand.enter).multiplyScalar(ent).addScaledVector(vTmp.set(...heroLayout.upperHand.exit), hero.handsOut);
  solved.camBlend = bus.hero.present ? smoothstep(range(p, T.camera[0], T.camera[1])) : 1;
  hero.laptopVisible = true;
  if (!model) requestAhead(p, bus.hero.present, vh);

  /* ---------- active station pair ---------- */
  const stations = bus.stations;
  let idx = -1;
  for (let i = 0; i < stations.length; i++) {
    const s = stations[i];
    const t = s.hero ? heroTravel(p) : s.travel;
    if (t > 0 || (s.hero && bus.hero.present)) idx = i;
  }

  c.show = false;
  c.owned = false;
  c.fade = 1;
  c.onHero = false;
  c.lookWeight = 0;
  c.oneShot = null;
  c.frames.name = null;
  solved.desk.show = false;

  if (idx >= 0) {
    const B = stations[idx];
    const A = idx > 0 ? stations[idx - 1] : null;
    const t = B.hero ? heroTravel(p) : B.travel;
    const te = easeInOutCubic(t);
    stationScreen(B, sB);
    c.station = B.id;
    c.stationPose = B.pose;
    const parked = B.hero ? p >= T.recover[1] : t >= 0.999;

    // Station feet in world space (the desk station stands beside the chair until a seated pose exists).
    screenToWorld(sB, vw, vh, vB);

    if (parked) {
      if (arrivedAt !== B.id) {
        arrivedAt = B.id;
        arrivalTime = clock;
        if (B.arrive) {
          c.oneShot = B.arrive;
          c.oneShotId++;
        }
      }
      c.lookWeight = B.pose === 'sit' && B.prop === 'desk' ? 0 : 1;
      if (c.lookWeight > 0) solveLook(vw, vh);
    } else if (arrivedAt === B.id && t < 0.9) {
      arrivedAt = ''; // left far enough that coming back replays the arrival
    }

    if (model) {
      /* ================= rigged GLB path ================= */
      if (B.hero) {
        vA.copy(heroLayout.seatRoot).add(hero.lowerOffset);
        c.pos.lerpVectors(vA, vB, te);
        c.pos.y += Math.sin(Math.PI * t) * heroLayout.leapHeight;
        c.onHero = t <= 0;
      } else if (t >= 1 || (!A && B.enter === 'none')) {
        c.pos.copy(vB);
      } else {
        if (B.enter !== 'none' || !A) {
          sOut.x = lerp(B.enter === 'left' ? -sB.h * 0.35 : vw + sB.h * 0.35, sB.x, te);
          sOut.y = sB.y;
          sOut.h = sB.h;
        } else {
          stationScreen(A, sA);
          sOut.x = lerp(sA.x, sB.x, te);
          sOut.y = lerp(sA.y, sB.y, te);
          sOut.h = lerp(sA.h, sB.h, te);
        }
        screenToWorld(sOut, vw, vh, c.pos);
      }
      if (parked && B.pose === 'sit' && B.prop !== 'desk') c.pos.y -= characterConfig.seat.height;
      c.hips.copy(c.pos);
      c.anchor = 0;

      const travelling = !parked && !(B.hero && t <= 0);
      if (prevScreen.valid && dt > 0 && !B.hero) c.speed = lerp(c.speed, (c.pos.distanceTo(lastFeet) / dt) * 1, 1 - Math.exp(-10 * dt));
      prevScreen.valid = !B.hero;
      if (B.hero && t <= 0 && bus.hero.present) {
        const entries = heroScrub(p, c.scrub);
        c.mode = entries.length ? 'scrub' : 'play';
        c.state = p < T.lid[0] ? 'typing' : 'sitIdle';
        c.yaw = heroLayout.seatYaw;
        c.onHero = true;
      } else if (B.hero && t < 1) {
        heroScrub(p, c.scrub);
        c.mode = 'scrub';
        c.yaw = lerp(heroLayout.seatYaw, B.facing, te);
      } else if (travelling) {
        c.mode = 'play';
        c.state = c.speed > 3 ? 'run' : c.speed > 0.12 ? 'walk' : 'idle';
        const dx = c.pos.x - lastFeet.x;
        if (Math.abs(dx) > 0.001) c.yaw = (dx > 0 ? 1 : -1) * 75 * DEG;
      } else {
        c.mode = 'play';
        c.state = B.state;
        c.yaw = B.facing;
      }
      c.shadow.opacity = 0;
    } else {
      /* ================= image character path ================= */
      let owned = false; // a dedicated render owns the character this frame
      if (B.hero && !parked) {
        // seated → closing → rising renders, then the base pose (which they hand over to)
        const heroPuppet = solveHeroPuppet(p, clock, hero.lowerOffset, baseOffset, baseFade);
        heroFrame(p, clock, hero.lowerOffset, vB, frame, baseOffset);
        c.onHero = p < T.leap[0];
        if (heroPuppet === 'owned') owned = true;
        c.fade = baseFade.value;
        // the renders carry their own MacBook; the 3D one takes over in his hand at the hand-over
        if (heroPuppet) hero.laptopVisible = heroPuppet === 'overlay';
      } else if (B.prop === 'desk' && (B.travel > 0 || parked)) {
        // Workspace: walk in, sit, the seated render (falls back to the base pose if not loaded yet)
        // just off the left edge (half his profile width), so the walk is short and on screen at once
        sOut.x = B.enter === 'left' ? -sB.h * 0.22 : vw + sB.h * 0.22;
        sOut.y = sB.y;
        sOut.h = sB.h;
        screenToWorld(sOut, vw, vh, vA);
        if (solveWalker(t, vB, vA, clock, frame.shadow)) owned = true;
        else if (parked) stationFrame(B.state, B.arrive, B.pose === 'sit', clock - arrivalTime, clock, vB, c.look, c.lookWeight, frame, hipsLiftOf(B));
        else {
          walkFrame(t, clock, vA, vB, frame);
          if (t > 0.9) blendSeated(smoothstep(range(t, 0.9, 1)), B, vB);
        }
      } else if (parked || (!A && B.enter === 'none')) {
        stationFrame(B.state, B.arrive, B.pose === 'sit', clock - arrivalTime, clock, vB, c.look, c.lookWeight, frame, hipsLiftOf(B));
        if (B.id === 'work') {
          // Selected Work: leaves the WORK letters, then flies across the projects
          takeoff(B, vh, tk);
          if (tk.t > 0) takeoffFrame(tk.t, clock, vB, tk.rise, frame);
        }
      } else {
        // Origin of the hop: the previous station, or just off-screen for entrances.
        if (B.enter !== 'none' || !A) {
          sOut.x = B.enter === 'left' ? -sB.h * 0.35 : vw + sB.h * 0.35;
          sOut.y = sB.y;
          sOut.h = sB.h;
          screenToWorld(sOut, vw, vh, vA);
        } else {
          screenToWorld(stationScreen(A, sA), vw, vh, vA);
        }
        // Entrances arrive on foot; long transitions between compositions are leaps.
        if (B.enter !== 'none') walkFrame(t, clock, vA, vB, frame);
        else travelFrame(t, clock, vA, vB, frame);
        // Seated stations: get up from the seat at the start, settle into it at the end.
        const seatedA = A && A.pose === 'sit' && B.enter === 'none';
        const seatedB = B.pose === 'sit';
        if (seatedA && t < 0.1) blendSeated(1 - smoothstep(range(t, 0, 0.1)), A!, vA);
        if (seatedB && t > 0.9) blendSeated(smoothstep(range(t, 0.9, 1)), B, vB);
      }
      copyRigPose(frame.rig, c.rig);
      copyRigPose(frame.overlay, c.rigOverlay);
      c.anchor = frame.anchor;
      c.pos.copy(frame.feet);
      c.hips.copy(frame.hips);
      c.shadow.pos.copy(frame.shadow.pos);
      c.shadow.opacity = frame.shadow.opacity;
      c.shadow.scale = frame.shadow.scale;
      c.yaw = 0;
      c.state = B.state;
      solveImage(frame.want, dt);
      if (!owned && solveFlight(clock, vw, vh)) owned = true;
      // the base pose keeps solving underneath (smooth hand-backs) but is not drawn
      c.owned = owned;
    }

    /* ---------- on-screen test ---------- */
    if (B.hero && !parked) {
      c.show = bus.hero.visible || t > 0;
    } else {
      worldToScreen(c.pos, vw, vh, sOut);
      const halfW = sOut.h * 0.35;
      c.show = sOut.x + halfW > -60 && sOut.x - halfW < vw + 60 && sOut.y > -60 && sOut.y - sOut.h * 1.2 < vh + 60;
    }
    // Exactly one character on screen: a dedicated render, or the base pose.
    if (c.owned) c.show = false;
    if (!bus.hero.visible && puppet.id?.startsWith('hero-')) {
      puppet.id = null;
      puppetUnder.id = null;
    }
    if (puppet.id === null && tk.t >= 1 && B.id === 'work') c.show = false;

    lastFeet.copy(c.pos);
  } else {
    prevScreen.valid = false;
    arrivedAt = '';
    tk.t = 0;
  }

  /* ---------- desk props follow their station whenever its section is on screen ---------- */
  for (let i = 0; i < stations.length; i++) {
    const s = stations[i];
    if (s.prop !== 'desk') continue;
    const sec = s.section.getBoundingClientRect();
    if (sec.bottom < -vh * 0.1 || sec.top > vh * 1.1) continue;
    stationScreen(s, sA);
    screenToWorld(sA, vw, vh, solved.desk.pos);
    // Desk faces the camera: the seated image character works across it toward us.
    solved.desk.yaw = -Math.PI / 2;
    if (!model && deskReady()) {
      // The photographed set replaces the procedural desk (never both on screen).
      placeDeskSet(solved.desk.pos, s.travel, range(-sec.top, 0, Math.max(1, sec.height - vh)), clock);
      solved.desk.show = false;
    } else {
      solved.desk.show = true;
    }
  }

  /* ---------- Selected Work panels ---------- */
  solvePanels(vw, vh);
  if (!model && c.station === 'work' && panelGesture > 0) {
    for (const k of Object.keys(PRESENT_BOTH) as (keyof typeof PRESENT_BOTH)[]) c.rig[k] += (PRESENT_BOTH[k] - STAND[k]) * panelGesture;
  }

  /* ---------- finale ---------- */
  const f = bus.finale;
  solved.finale.q = f.present ? f.progress : 0;
  const stage = f.screen?.parentElement ?? null;
  const pinned = stage !== null && stage.getBoundingClientRect().top <= 1;
  solved.finale.active = Boolean(f.present && f.visible && pinned && solved.finale.q < 0.9995);
  // Light header ink once the dark screen fills the view.
  const lightHeader = Boolean(f.present && f.visible && pinned && solved.finale.q > 0.78);
  if ((document.documentElement.dataset.header === 'light') !== lightHeader) {
    if (lightHeader) document.documentElement.dataset.header = 'light';
    else delete document.documentElement.dataset.header;
  }
  if (solved.finale.active) c.show = false;
  else if (f.screen) {
    // Outside the flight the footer is either not yet on the laptop, or it IS the page.
    const landed = f.present && solved.finale.q >= 0.9995;
    if (landed && f.screen.style.transform !== 'none') {
      f.screen.style.transform = 'none';
      f.screen.style.visibility = 'visible';
    } else if (!landed && f.screen.style.visibility !== 'hidden') {
      f.screen.style.visibility = 'hidden';
    }
  }

  if (solved.finale.active) {
    puppet.id = null;
    puppetUnder.id = null;
    deskSet.show = false;
  }
  solved.any = hero.show || c.show || solved.desk.show || solved.finale.active || solved.panels.show || puppet.id !== null || deskSet.show;
  return solved;
}

export const clampDt = (dt: number) => clamp(dt, 0, 0.1);
