/**
 * Director — solves, once per tick and before rendering, where everything
 * should be: camera blend, hero props, character position/state, desk props.
 *
 * Inputs are the scene bus (scroll-driven progress written by GSAP) and live
 * station rects from the DOM. Outputs go into `solved`, which the R3F
 * components apply in useFrame. Keeping DOM reads here (one batch, no writes)
 * avoids layout thrash, and lets the frame driver skip rendering entirely when
 * nothing is on screen.
 */
import * as THREE from 'three';
import { bus, type StationRecord } from '@/lib/scene-bus';
import { characterConfig, hasCharacterModel } from '@/config/character.config';
import { clamp, easeInOutCubic, easeOutCubic, lerp, range, smoothstep } from '@/lib/math';
import type { CharacterState, StationPose } from '@/types/character';
import { heroLayout } from '../scenes/hero/heroLayout';

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
    pos: new THREE.Vector3(),
    yaw: 0,
    mode: 'play' as 'play' | 'scrub',
    state: 'idle' as CharacterState,
    oneShot: null as CharacterState | null,
    oneShotId: 0,
    scrub: [] as ScrubEntry[],
    /** World speed (m/s) used to time walk cycles to ground speed. */
    speed: 0,
    /** Look target in NDC (-1..1), weight 0..1. */
    look: new THREE.Vector2(),
    lookWeight: 0,
    pose: 'stand' as StationPose,
    station: '',
    /** True while the character is on the hero hand (laptop belongs to him). */
    onHero: false,
  },
  desk: {
    show: false,
    pos: new THREE.Vector3(),
    yaw: 0,
  },
};

/* ---------- scratch (no allocation per frame) ---------- */
const vA = new THREE.Vector3();
const vB = new THREE.Vector3();
const vTmp = new THREE.Vector3();
const prevScreen = { x: 0, y: 0, h: 0, valid: false };
let arrivedAt = '';
let leftAt = '';

interface ScreenPoint {
  x: number;
  y: number;
  h: number;
}
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

function heroTravel(p: number) {
  return range(p, heroLayout.timeline.leap[0], heroLayout.timeline.leap[1]);
}

/** Character animation during the hero sequence — a pure function of progress. */
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

export function solveFrame(vw: number, vh: number, dt: number) {
  const c = solved.character;
  const hero = solved.hero;
  const model = hasCharacterModel();

  /* ---------- hero ---------- */
  const p = bus.hero.present ? bus.hero.progress : 1;
  hero.p = p;
  hero.entrance = bus.hero.present ? bus.hero.entrance : 1;
  hero.show = bus.hero.present && bus.hero.visible && p < 0.985;
  hero.lid = 1 - smoothstep(range(p, heroLayout.timeline.lid[0], heroLayout.timeline.lid[1]));
  hero.handsOut = easeInOutCubic(range(p, heroLayout.timeline.hands[0], heroLayout.timeline.hands[1]));
  hero.dissolve = range(p, heroLayout.timeline.sky[0], heroLayout.timeline.sky[1]);
  const ent = 1 - easeOutCubic(hero.entrance);
  hero.lowerOffset
    .set(...heroLayout.lowerHand.enter)
    .multiplyScalar(ent)
    .addScaledVector(vTmp.set(...heroLayout.lowerHand.exit), hero.handsOut);
  hero.upperOffset
    .set(...heroLayout.upperHand.enter)
    .multiplyScalar(ent)
    .addScaledVector(vTmp.set(...heroLayout.upperHand.exit), hero.handsOut);
  solved.camBlend = bus.hero.present ? smoothstep(range(p, heroLayout.timeline.camera[0], heroLayout.timeline.camera[1])) : 1;

  /* ---------- active station pair ---------- */
  const stations = bus.stations;
  let idx = -1;
  for (let i = 0; i < stations.length; i++) {
    const s = stations[i];
    const t = s.hero ? heroTravel(p) : s.travel;
    if (t > 0 || (s.hero && bus.hero.present)) idx = i;
  }

  c.show = false;
  c.onHero = false;
  c.lookWeight = 0;
  c.oneShot = null;
  solved.desk.show = false;

  if (idx >= 0) {
    const B = stations[idx];
    const A = idx > 0 ? stations[idx - 1] : null;
    const t = B.hero ? heroTravel(p) : B.travel;
    const te = easeInOutCubic(t);
    stationScreen(B, sB);

    let D: number;
    if (B.hero) {
      // World-space leap from the hand to the intro station (solved for the page camera).
      D = screenToWorld(sB, vw, vh, vB);
      vA.copy(model ? heroLayout.seatRoot : heroLayout.standPoint).add(hero.lowerOffset);
      c.pos.lerpVectors(vA, vB, te);
      c.pos.y += Math.sin(Math.PI * t) * heroLayout.leapHeight;
      c.onHero = t <= 0;
    } else {
      if (t >= 1 || (!A && B.enter === 'none')) {
        sOut.x = sB.x;
        sOut.y = sB.y;
        sOut.h = sB.h;
      } else if (B.enter !== 'none' || !A) {
        const off = B.enter === 'left' ? -sB.h * 0.35 : vw + sB.h * 0.35;
        sOut.x = lerp(off, sB.x, te);
        sOut.y = sB.y;
        sOut.h = sB.h;
      } else {
        stationScreen(A, sA);
        sOut.x = lerp(sA.x, sB.x, te);
        sOut.y = lerp(sA.y, sB.y, te);
        sOut.h = lerp(sA.h, sB.h, te);
      }
      D = screenToWorld(sOut, vw, vh, c.pos);
    }

    /* seated on an edge (e.g. the WORK letters): drop the root so the hips meet the surface */
    const parked = t >= 0.999;
    if (model && parked && B.pose === 'sit' && B.prop !== 'desk') c.pos.y -= characterConfig.seat.height;
    /* placeholder can't sit: stand beside the chair instead of inside it */
    if (!model && B.prop === 'desk') {
      c.pos.x -= 0.62 * te;
      c.pos.z += 0.25 * te;
    }

    /* ---------- on-screen test (feet point + height, generous margin) ---------- */
    const scr = B.hero && t < 1 ? null : sOut;
    if (scr) {
      const halfW = scr.h * 0.3;
      c.show = scr.x + halfW > -40 && scr.x - halfW < vw + 40 && scr.y > -40 && scr.y - scr.h < vh + 40;
    } else {
      c.show = bus.hero.visible;
    }

    /* ---------- state ---------- */
    c.station = B.id;
    c.pose = B.pose;
    const travelling = !parked && !(B.hero && t <= 0);
    const metresPerPx = (2 * D * TAN) / vh;
    let speed = 0;
    if (prevScreen.valid && dt > 0 && !B.hero) {
      speed = (Math.hypot(sOut.x - prevScreen.x, sOut.y - prevScreen.y) * metresPerPx) / dt;
    }
    c.speed = lerp(c.speed, speed, 1 - Math.exp(-10 * dt));
    if (!B.hero) {
      const dx = sOut.x - prevScreen.x;
      prevScreen.x = sOut.x;
      prevScreen.y = sOut.y;
      prevScreen.h = sOut.h;
      prevScreen.valid = true;
      if (travelling && Math.abs(dx) > 0.15) c.yaw = (dx > 0 ? 1 : -1) * 75 * DEG;
    } else {
      prevScreen.valid = false;
    }

    if (B.hero && t <= 0 && bus.hero.present) {
      // On the hand: typing loop, then scrubbed close-laptop → stand-up.
      const entries = heroScrub(p, c.scrub);
      c.mode = entries.length ? 'scrub' : 'play';
      c.state = p < heroLayout.timeline.lid[0] ? 'typing' : 'sitIdle';
      c.yaw = heroLayout.seatYaw;
      c.onHero = true;
    } else if (B.hero && t < 1) {
      heroScrub(p, c.scrub);
      c.mode = 'scrub';
      c.yaw = lerp(heroLayout.seatYaw, B.facing, te);
    } else if (travelling) {
      c.mode = 'play';
      c.state = c.speed > 3 ? 'run' : c.speed > 0.12 ? 'walk' : 'idle';
    } else {
      c.mode = 'play';
      c.state = B.state;
      c.yaw = B.facing;
      if (arrivedAt !== B.id && B.arrive) {
        c.oneShot = B.arrive;
        c.oneShotId++;
      }
      arrivedAt = B.id;
      leftAt = '';
      c.lookWeight = B.pose === 'sit' && B.prop === 'desk' ? 0 : 1;
    }
    if (travelling && arrivedAt === B.id && t < 0.9) {
      // left the station far enough that returning should replay the arrival
      leftAt = B.id;
      arrivedAt = '';
    }

    /* ---------- look target: a [data-look] element near centre, else the cursor ---------- */
    if (c.lookWeight > 0) {
      let found = false;
      for (const el of bus.lookTargets) {
        const r = el.getBoundingClientRect();
        if (r.bottom > vh * 0.2 && r.top < vh * 0.8 && r.width > 0) {
          c.look.set(((r.left + r.width / 2) / vw) * 2 - 1, 1 - ((r.top + r.height / 2) / vh) * 2);
          found = true;
          break;
        }
      }
      if (!found && bus.pointer.active) c.look.set(bus.pointer.nx, bus.pointer.ny);
    }
  } else {
    prevScreen.valid = false;
    arrivedAt = '';
  }
  void leftAt;

  if (!model) {
    // The 2D placeholder always faces the camera; yaw would only shear it.
    c.yaw = 0;
  }

  /* ---------- desk props follow their station whenever its section is on screen ---------- */
  for (let i = 0; i < stations.length; i++) {
    const s = stations[i];
    if (s.prop !== 'desk') continue;
    const sec = s.section.getBoundingClientRect();
    if (sec.bottom < -vh * 0.1 || sec.top > vh * 1.1) continue;
    stationScreen(s, sA);
    screenToWorld(sA, vw, vh, solved.desk.pos);
    solved.desk.yaw = s.facing - Math.PI / 2;
    solved.desk.show = true;
  }

  solved.any = hero.show || c.show || solved.desk.show;
  return solved;
}

export const clampDt = (dt: number) => clamp(dt, 0, 0.1);
