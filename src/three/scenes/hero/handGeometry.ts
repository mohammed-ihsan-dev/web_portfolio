/**
 * Procedural sculpture hand. Primitives (rounded palm, capsule phalanges,
 * tapered forearm) are posed with matrices and merged into ONE geometry, so
 * each hand is a single draw call. Units are metres; the palm is ~1 m long.
 *
 * Local frame: palm centre at the origin, fingers along +X, palm surface
 * facing +Y, thumb on the +Z side (pass `thumbSide: -1` to mirror).
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export const PALM_TOP = 0.15;

export interface HandPose {
  /** Curl per finger (index, middle, ring, pinky) per joint, radians (+ bends toward the palm). */
  curls: [number, number, number][];
  /** Sideways spread per finger, radians. */
  spread: [number, number, number, number];
  /** Thumb: base yaw (toward fingers), base lift, joint curls. */
  thumb: { yaw: number; lift: number; curls: [number, number, number] };
  thumbSide?: 1 | -1;
  forearmLength?: number;
}

export const RELAXED_OPEN: HandPose = {
  curls: [
    [0.18, 0.22, 0.16],
    [0.24, 0.28, 0.2],
    [0.32, 0.34, 0.24],
    [0.42, 0.4, 0.3],
  ],
  spread: [0.1, 0.02, -0.06, -0.15],
  thumb: { yaw: 0.85, lift: 0.18, curls: [0.15, 0.22, 0.2] },
};

export const POINTING: HandPose = {
  curls: [
    [0.06, 0.08, 0.05],
    [1.05, 1.25, 0.85],
    [1.2, 1.3, 0.9],
    [1.3, 1.25, 0.85],
  ],
  spread: [0.06, 0.0, -0.05, -0.1],
  thumb: { yaw: 1.05, lift: 0.32, curls: [0.35, 0.55, 0.45] },
};

const FINGERS = [
  { z: 0.31, len: [0.44, 0.27, 0.21], r: 0.1, baseX: 0.47 },
  { z: 0.1, len: [0.48, 0.3, 0.22], r: 0.105, baseX: 0.5 },
  { z: -0.11, len: [0.45, 0.28, 0.21], r: 0.098, baseX: 0.48 },
  { z: -0.3, len: [0.35, 0.22, 0.18], r: 0.086, baseX: 0.42 },
];

const tmpM = new THREE.Matrix4();
const rotZ = (a: number) => new THREE.Matrix4().makeRotationZ(a);
const rotY = (a: number) => new THREE.Matrix4().makeRotationY(a);
const trans = (x: number, y: number, z: number) => new THREE.Matrix4().makeTranslation(x, y, z);

/** Capsule from the current frame's origin along +X with the given length. */
function segment(frame: THREE.Matrix4, length: number, radius: number) {
  const g = new THREE.CapsuleGeometry(radius, Math.max(0.001, length - radius * 0.4), 6, 14);
  // Capsule axis is +Y; lay it along +X and move its centre to length/2.
  g.applyMatrix4(tmpM.makeRotationZ(-Math.PI / 2));
  g.applyMatrix4(trans(length / 2, 0, 0));
  g.applyMatrix4(frame);
  return g;
}

function chain(base: THREE.Matrix4, lengths: number[], radius: number, curls: number[], taper = 0.9) {
  const parts: THREE.BufferGeometry[] = [];
  const frame = base.clone();
  let r = radius;
  for (let j = 0; j < lengths.length; j++) {
    frame.multiply(rotZ(curls[j] ?? 0));
    parts.push(segment(frame, lengths[j], r));
    // knuckle: a slightly fatter sphere where segments meet
    const k = new THREE.SphereGeometry(r * 1.0, 16, 12);
    k.applyMatrix4(frame);
    parts.push(k);
    frame.multiply(trans(lengths[j], 0, 0));
    r *= taper;
  }
  return parts;
}

export function buildHandGeometry(pose: HandPose): THREE.BufferGeometry {
  const side = pose.thumbSide ?? 1;
  const parts: THREE.BufferGeometry[] = [];

  /* palm: rounded slab, tapered toward the wrist and gently cupped */
  const palm = new RoundedBoxGeometry(1.0, 0.3, 0.86, 5, 0.13);
  const pos = palm.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    let y = pos.getY(i);
    let z = pos.getZ(i);
    const t = (x + 0.5) / 1.0; // 0 wrist → 1 knuckles
    z *= 0.82 + 0.18 * t;
    if (y > 0) y += 0.05 * Math.pow(Math.abs(z) / 0.43, 2) - 0.015;
    y *= 1 - 0.12 * (1 - t);
    pos.setXYZ(i, x, y, z);
  }
  palm.computeVertexNormals();
  parts.push(palm);

  /* thenar pad (base of the thumb) */
  const pad = new THREE.SphereGeometry(0.3, 18, 14);
  pad.applyMatrix4(new THREE.Matrix4().makeScale(1.25, 0.55, 0.8));
  pad.applyMatrix4(trans(-0.1, -0.02, 0.24 * side));
  parts.push(pad);

  /* fingers */
  FINGERS.forEach((f, i) => {
    const base = trans(f.baseX, 0.02, f.z * side).multiply(rotY(-pose.spread[i] * side));
    parts.push(...chain(base, f.len, f.r, pose.curls[i], 0.87));
  });

  /* thumb: metacarpal + two phalanges, leaving the palm diagonally */
  const tb = trans(-0.05, -0.03, 0.36 * side)
    .multiply(rotY(-pose.thumb.yaw * side))
    .multiply(new THREE.Matrix4().makeRotationX(-pose.thumb.lift * side));
  parts.push(...chain(tb, [0.34, 0.26, 0.2], 0.125, pose.thumb.curls, 0.88));

  /* wrist + forearm: tapered, slightly oval, running off along -X */
  const len = pose.forearmLength ?? 3.4;
  // After rotZ(+90°) the cylinder's top (+Y) points to -X: top = elbow (wide), bottom = wrist (narrow).
  const arm = new THREE.CylinderGeometry(0.44, 0.27, len, 28, 6, false);
  arm.applyMatrix4(rotZ(Math.PI / 2));
  arm.applyMatrix4(new THREE.Matrix4().makeScale(1, 0.72, 1.12));
  arm.applyMatrix4(trans(-0.42 - len / 2, -0.02, 0));
  parts.push(arm);
  const wrist = new THREE.SphereGeometry(0.4, 24, 16);
  wrist.applyMatrix4(new THREE.Matrix4().makeScale(0.82, 0.6, 1.04));
  wrist.applyMatrix4(trans(-0.45, -0.02, 0));
  parts.push(wrist);

  // Normalise attributes so mergeGeometries accepts the mix of primitives.
  const prepared = parts.map((g) => {
    const ng = g.index ? g : mergeVertices(g);
    for (const key of Object.keys(ng.attributes)) if (key !== 'position' && key !== 'normal' && key !== 'uv') ng.deleteAttribute(key);
    return ng;
  });
  const merged = mergeGeometries(prepared, false);
  parts.forEach((g) => g.dispose());
  if (!merged) throw new Error('Hand geometry merge failed');
  merged.computeBoundingSphere();
  return merged;
}
