/**
 * Procedural layers applied AFTER the mixer each frame (rigged model only):
 *   look-at  — neck/head yaw+pitch toward a target, clamped and damped
 *   blink    — morph targets on a randomised schedule (if the model has them)
 *   breathing— a tiny chest rotation, additive on top of the clip
 */
import * as THREE from 'three';
import { characterConfig } from '@/config/character.config';
import { damp } from '@/lib/math';

export interface Rig {
  head: THREE.Bone | null;
  neck: THREE.Bone | null;
  chest: THREE.Bone | null;
  blink: { mesh: THREE.Mesh; indices: number[] }[];
  hasBlink: boolean;
}

export function findRig(root: THREE.Object3D): Rig {
  const rig: Rig = { head: null, neck: null, chest: null, blink: [], hasBlink: false };
  root.traverse((o) => {
    const name = o.name.toLowerCase();
    if ((o as THREE.Bone).isBone) {
      if (!rig.head && /head$/.test(name) && !/top|end/.test(name)) rig.head = o as THREE.Bone;
      if (!rig.neck && /neck$/.test(name)) rig.neck = o as THREE.Bone;
      if (!rig.chest && /(spine2|spine_02|chest|upperchest)$/.test(name)) rig.chest = o as THREE.Bone;
    }
    const mesh = o as THREE.Mesh;
    if (mesh.isMesh && mesh.morphTargetDictionary) {
      const indices = Object.entries(mesh.morphTargetDictionary)
        .filter(([k]) => /blink/i.test(k))
        .map(([, v]) => v);
      if (indices.length) rig.blink.push({ mesh, indices });
    }
  });
  rig.hasBlink = rig.blink.length > 0;
  return rig;
}

const qYaw = new THREE.Quaternion();
const qPitch = new THREE.Quaternion();
const Y = new THREE.Vector3(0, 1, 0);
const X = new THREE.Vector3(1, 0, 0);

export class ProceduralLayer {
  private yaw = 0;
  private pitch = 0;
  private nextBlink = 2;
  private blinkT = -1;
  private time = 0;

  constructor(private rig: Rig) {}

  update(dt: number, look: THREE.Vector2, lookWeight: number, breathing: boolean) {
    const cfg = characterConfig.procedural;
    this.time += dt;

    /* look-at (screen-space target → head yaw/pitch) */
    if (cfg.lookAt.enabled && (this.rig.head || this.rig.neck)) {
      const ty = THREE.MathUtils.clamp(look.x * cfg.lookAt.maxYaw, -cfg.lookAt.maxYaw, cfg.lookAt.maxYaw) * lookWeight;
      const tp = THREE.MathUtils.clamp(-look.y * cfg.lookAt.maxPitch, -cfg.lookAt.maxPitch, cfg.lookAt.maxPitch) * lookWeight;
      this.yaw = damp(this.yaw, ty, 4, dt);
      this.pitch = damp(this.pitch, tp, 4, dt);
      const share = cfg.lookAt.headShare;
      const apply = (bone: THREE.Bone | null, amount: number) => {
        if (!bone) return;
        qYaw.setFromAxisAngle(Y, this.yaw * amount);
        qPitch.setFromAxisAngle(X, this.pitch * amount);
        bone.quaternion.multiply(qYaw).multiply(qPitch);
      };
      apply(this.rig.neck, 1 - share);
      apply(this.rig.head, this.rig.neck ? share : 1);
    }

    /* breathing */
    if (cfg.breathing.enabled && breathing && this.rig.chest) {
      const b = Math.sin(this.time * Math.PI * 2 * cfg.breathing.rate) * cfg.breathing.amount;
      qPitch.setFromAxisAngle(X, b);
      this.rig.chest.quaternion.multiply(qPitch);
    }

    /* blink */
    if (cfg.blink.enabled && this.rig.hasBlink) {
      if (this.blinkT < 0 && this.time >= this.nextBlink) this.blinkT = 0;
      let v = 0;
      if (this.blinkT >= 0) {
        this.blinkT += dt;
        const p = this.blinkT / cfg.blink.duration;
        v = p < 0.5 ? p * 2 : Math.max(0, 2 - p * 2);
        if (p >= 1) {
          this.blinkT = -1;
          this.nextBlink = this.time + cfg.blink.minInterval + Math.random() * (cfg.blink.maxInterval - cfg.blink.minInterval);
        }
      }
      for (const { mesh, indices } of this.rig.blink) {
        const inf = mesh.morphTargetInfluences;
        if (inf) for (const i of indices) inf[i] = v;
      }
    }
  }
}
