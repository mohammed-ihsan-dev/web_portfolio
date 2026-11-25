/**
 * Character animation controller on top of THREE.AnimationMixer.
 *
 * Two modes, freely mixed, with every action's weight damped toward a target
 * (so switching never snaps):
 *   play(state)  — time-based playback; loops, or one-shot then fall back.
 *   scrub([...]) — scroll-driven: explicit clip time + weight per state,
 *                  so reverse scrolling replays poses exactly.
 *
 * Clip names are resolved through `clipMap` with fallbacks; missing clips are
 * reported (debug HUD), never faked.
 */
import * as THREE from 'three';
import type { CharacterState, ClipSpec } from '@/types/character';
import type { ScrubEntry } from '../director/director';

const normalise = (name: string) =>
  name
    .toLowerCase()
    .replace(/^(armature|rig|root)\|/, '')
    .replace(/mixamo\.com/g, '')
    .replace(/[^a-z0-9]/g, '');

interface Resolved {
  state: CharacterState;
  via: CharacterState;
  clip: THREE.AnimationClip | null;
  action: THREE.AnimationAction | null;
  spec: ClipSpec;
}

/** Remove horizontal hips translation so the director owns position. */
function stripRootMotion(clip: THREE.AnimationClip) {
  const c = clip.clone();
  for (const track of c.tracks) {
    if (!/hips\.position$/i.test(track.name)) continue;
    const v = track.values;
    const x0 = v[0];
    const z0 = v[2];
    for (let i = 0; i < v.length; i += 3) {
      v[i] = x0;
      v[i + 2] = z0;
    }
  }
  return c;
}

export class AnimationController {
  readonly mixer: THREE.AnimationMixer;
  private resolved = new Map<CharacterState, Resolved>();
  private weights = new Map<THREE.AnimationAction, number>();
  private targets = new Map<THREE.AnimationAction, number>();
  private scrubbed = new Set<THREE.AnimationAction>();
  private current: THREE.AnimationAction | null = null;
  private oneShot: { action: THREE.AnimationAction; returnTo: CharacterState } | null = null;
  private fade = 0.35;
  private speedScale = 1;

  constructor(root: THREE.Object3D, clips: THREE.AnimationClip[], map: Record<CharacterState, ClipSpec>) {
    this.mixer = new THREE.AnimationMixer(root);
    const byName = new Map<string, THREE.AnimationClip>();
    clips.forEach((c) => byName.set(normalise(c.name), c));

    const find = (spec: ClipSpec) => {
      for (const n of spec.names) {
        const c = byName.get(normalise(n));
        if (c) return c;
      }
      return null;
    };

    const actionFor = new Map<THREE.AnimationClip, THREE.AnimationAction>();
    (Object.keys(map) as CharacterState[]).forEach((state) => {
      let via: CharacterState = state;
      let clip = find(map[state]);
      const seen = new Set<CharacterState>([state]);
      while (!clip && map[via].fallback && !seen.has(map[via].fallback!)) {
        via = map[via].fallback!;
        seen.add(via);
        clip = find(map[via]);
      }
      if (!clip && via !== 'idle') {
        via = 'idle';
        clip = find(map.idle);
      }
      let action: THREE.AnimationAction | null = null;
      if (clip) {
        const spec = map[via];
        if (!actionFor.has(clip)) {
          const prepared = spec.inPlace ? stripRootMotion(clip) : clip;
          const a = this.mixer.clipAction(prepared);
          a.setLoop(spec.loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
          a.clampWhenFinished = !spec.loop;
          a.enabled = true;
          a.setEffectiveWeight(0);
          a.play();
          actionFor.set(clip, a);
          this.weights.set(a, 0);
          this.targets.set(a, 0);
        }
        action = actionFor.get(clip)!;
      }
      this.resolved.set(state, { state, via, clip, action, spec: map[state] });
    });

    this.mixer.addEventListener('finished', (e) => {
      const os = this.oneShot;
      if (os && e.action === os.action) {
        this.oneShot = null;
        this.play(os.returnTo);
      }
    });
  }

  /** Human-readable resolution table for the debug HUD / docs. */
  report() {
    return [...this.resolved.values()]
      .map((r) => `${r.state}: ${r.clip ? `${r.clip.name}${r.via !== r.state ? ` (via ${r.via})` : ''}` : 'MISSING'}`)
      .join('\n');
  }

  has(state: CharacterState) {
    return Boolean(this.resolved.get(state)?.action);
  }

  /** Playback rate multiplier (walk cycles matched to ground speed). */
  setSpeed(scale: number) {
    this.speedScale = scale;
  }

  play(state: CharacterState, opts?: { once?: boolean; then?: CharacterState }) {
    const r = this.resolved.get(state);
    const action = r?.action ?? null;
    if (!action) return;
    this.fade = r!.spec.fade ?? 0.35;
    this.leaveScrub();
    // Only real one-shot clips play once; a fallback (e.g. wave → idle) keeps looping.
    if (opts?.once && r!.via === state && !r!.spec.loop) {
      action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true;
      action.reset();
      this.oneShot = { action, returnTo: opts.then ?? 'idle' };
    } else if (this.oneShot && this.oneShot.action !== action) {
      // a new loop request while a one-shot runs: remember it as the return state
      this.oneShot.returnTo = state;
      return;
    }
    if (this.current === action && !opts?.once) return;
    if (this.current !== action && !r!.spec.loop && !opts?.once) action.reset();
    this.current = action;
    this.targets.forEach((_, a) => this.targets.set(a, a === action ? 1 : 0));
  }

  scrub(entries: ScrubEntry[]) {
    this.oneShot = null;
    this.current = null;
    this.fade = 0.12;
    this.targets.forEach((_, a) => this.targets.set(a, 0));
    const next = new Set<THREE.AnimationAction>();
    for (const e of entries) {
      const action = this.resolved.get(e.state)?.action;
      if (!action) continue;
      const clip = action.getClip();
      action.paused = true;
      action.time = Math.min(clip.duration - 1e-3, Math.max(0, e.t) * clip.duration);
      this.targets.set(action, Math.max(this.targets.get(action) ?? 0, e.w));
      next.add(action);
    }
    this.scrubbed.forEach((a) => {
      if (!next.has(a)) a.paused = false;
    });
    this.scrubbed = next;
  }

  private leaveScrub() {
    this.scrubbed.forEach((a) => {
      a.paused = false;
    });
    this.scrubbed.clear();
  }

  update(dt: number) {
    const k = 1 - Math.exp(-dt / Math.max(0.05, this.fade / 3));
    let total = 0;
    this.weights.forEach((w, a) => {
      const target = this.targets.get(a) ?? 0;
      const nw = w + (target - w) * k;
      this.weights.set(a, nw);
      total += nw;
    });
    // Normalise so partial crossfades never produce a sub-weight (shrinking) pose.
    this.weights.forEach((w, a) => {
      a.setEffectiveWeight(total > 1e-4 ? w / Math.max(total, 1) : 0);
      if (!this.scrubbed.has(a)) a.setEffectiveTimeScale(a === this.current ? this.speedScale : 1);
    });
    this.mixer.update(dt);
  }

  dispose() {
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.mixer.getRoot());
  }
}
