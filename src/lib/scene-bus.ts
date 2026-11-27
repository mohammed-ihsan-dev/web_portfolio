/**
 * Scene bus — the only bridge between DOM choreography (GSAP/ScrollTrigger)
 * and the WebGL scene. A plain mutable object: writers set fields during the
 * ticker, the render loop reads them in the same frame. No React state, no
 * allocations per frame, no imports from three.js (safe for any bundle).
 */
import type { CharacterState, StationEnter, StationPose } from '@/types/character';

export interface StationRecord {
  id: string;
  el: HTMLElement;
  /** Element whose scroll position drives `travel`. */
  section: HTMLElement;
  index: number;
  /** 0 → 1 arrival progress, written by the motion runtime. */
  travel: number;
  enter: StationEnter;
  pose: StationPose;
  /** Looping state while parked here. */
  state: CharacterState;
  /** Optional one-shot played on arrival before `state`. */
  arrive: CharacterState | null;
  /** Yaw (radians) while parked; 0 faces the camera. */
  facing: number;
  prop: 'desk' | null;
  /** Travel driven by the hero timeline instead of a ScrollTrigger. */
  hero: boolean;
}

type Listener = () => void;

export const bus = {
  /** True once the desktop runtime has initialised (motion + stations). */
  enabled: false,
  route: '/',
  scroll: { y: 0, velocity: 0 },
  pointer: { x: 0, y: 0, nx: 0, ny: 0, active: false },
  hero: {
    present: false,
    /** Section is (partly) on screen. */
    visible: false,
    /** 0 → 1 scrubbed progress of the hero → intro sequence. */
    progress: 0,
    /** 0 → 1 entrance after the preloader (sky fade-in, character settle). */
    entrance: 0,
  },
  finale: {
    present: false,
    visible: false,
    /** 0 → 1 scrubbed progress of the MacBook → footer sequence. */
    progress: 0,
    /** The footer element mapped onto the 3D display. */
    screen: null as HTMLElement | null,
  },
  /** Selected Work flight: one record per project row (progress written by ScrollTrigger). */
  flight: {
    rows: [] as { el: HTMLElement; media: HTMLElement; img: HTMLElement | null; index: number; progress: number }[],
  },
  /** Project panel slots in Selected Work (3D panels land on these links). */
  panelSlots: [] as HTMLElement[],
  stations: [] as StationRecord[],
  /** Elements the character may glance at (e.g. the project in view). */
  lookTargets: [] as HTMLElement[],
  /** Increments whenever stations are rebuilt (route change, resize). */
  layoutVersion: 0,
  sceneReady: false,
  characterReady: false,
  /** Set by the scene each frame for the debug HUD. */
  debug: { fps: 0, dpr: 1, state: 'idle' as CharacterState, station: '', rendering: false, clips: '' },
};

const listeners = new Map<string, Set<Listener>>();

export function emit(event: string) {
  listeners.get(event)?.forEach((fn) => fn());
}

export function on(event: string, fn: Listener) {
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event)!.add(fn);
  return () => {
    listeners.get(event)?.delete(fn);
  };
}

/** Render hooks run inside the single GSAP ticker, after Lenis has advanced. */
const tickHooks = new Set<(time: number, dt: number) => void>();
export function addTickHook(fn: (time: number, dt: number) => void) {
  tickHooks.add(fn);
  return () => {
    tickHooks.delete(fn);
  };
}
export function runTickHooks(time: number, dt: number) {
  tickHooks.forEach((fn) => fn(time, dt));
}
