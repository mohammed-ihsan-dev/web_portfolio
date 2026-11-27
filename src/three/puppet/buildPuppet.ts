/**
 * Builds a layered 2D puppet: one skinned mesh per layer (back → front), all
 * sharing one in-plane skeleton. Each layer is a grid over its texture rect
 * (empty cells skipped); every vertex gets up to four bone weights from the
 * layer's rules (soft chains along limbs, feathered regions for head/hands),
 * so deformations are smooth and the face is only ever moved rigidly.
 *
 * Hidden parts (torso under an arm, the far leg behind the near one) were
 * painted at asset-prep time, so rotating a limb never opens a hole.
 */
import * as THREE from 'three';
import type { PuppetAsset, WeightRule } from './puppets';

type P2 = [number, number];

export interface BonePose {
  /** In-plane rotation (radians, counter-clockwise on screen). */
  r?: number;
  /** Offset in metres (x right, y up). */
  x?: number;
  y?: number;
  /** Uniform / per-axis scale (1 = rest). */
  sx?: number;
  sy?: number;
}
export type PuppetPose = Record<string, BonePose>;

export interface Puppet {
  /** Holds every layer mesh; its origin is the chosen anchor. */
  group: THREE.Group;
  meshes: Record<string, THREE.SkinnedMesh>;
  materials: Record<string, THREE.MeshBasicMaterial>;
  bones: Record<string, THREE.Bone>;
  /** Apply a pose (bones not listed return to rest). */
  setPose(pose: PuppetPose): void;
  setOpacity(o: number, layer?: string): void;
  /** World-free local position (metres) of a source-px point under the current pose of `bone`. */
  pointOnBone(bone: string, src: P2, out: THREE.Vector3): THREE.Vector3;
  dispose(): void;
}

function inPoly(x: number, y: number, poly: P2[]) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
/** Signed distance to a polygon (px): positive inside. */
function signedDistance(x: number, y: number, poly: P2[]) {
  let best = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [ax, ay] = poly[j];
    const [bx, by] = poly[i];
    const dx = bx - ax;
    const dy = by - ay;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
    best = Math.min(best, Math.hypot(ax + dx * t - x, ay + dy * t - y));
  }
  return inPoly(x, y, poly) ? best : -best;
}
const smooth = (t: number) => {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
};

/** Weights along a joint chain with soft blends at the joints (source px units). */
function chainWeights(x: number, y: number, pts: P2[], bones: string[], parent: string, blend: number, startBlend: number): Map<string, number> {
  const seg: number[] = [0];
  for (let i = 1; i < pts.length; i++) seg.push(seg[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  let best = Infinity;
  let s = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i];
    const [bx, by] = pts[i + 1];
    const dx = bx - ax;
    const dy = by - ay;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
    const d = Math.hypot(ax + dx * t - x, ay + dy * t - y);
    if (d < best) {
      best = d;
      s = seg[i] + t * (seg[i + 1] - seg[i]);
    }
  }
  const m = new Map<string, number>();
  if (s < startBlend) {
    const w = smooth(s / startBlend);
    m.set(parent, 1 - w);
    m.set(bones[0], (m.get(bones[0]) ?? 0) + w);
    return m;
  }
  for (let k = 1; k < bones.length; k++) {
    const j = seg[k];
    if (Math.abs(s - j) < blend) {
      const w = smooth((s - (j - blend)) / (2 * blend));
      m.set(bones[k - 1], 1 - w);
      m.set(bones[k], w);
      return m;
    }
    if (s < j) {
      m.set(bones[k - 1], 1);
      return m;
    }
  }
  m.set(bones[bones.length - 1], 1);
  return m;
}

function mixInto(cur: Map<string, number>, next: Map<string, number>, t: number) {
  if (t <= 0) return;
  for (const [k, v] of cur) cur.set(k, v * (1 - t));
  for (const [k, v] of next) cur.set(k, (cur.get(k) ?? 0) + v * t);
}

function weightsAt(x: number, y: number, rules: WeightRule[], base: string): Map<string, number> {
  const w = new Map<string, number>([[base, 1]]);
  for (const r of rules) {
    const s = r.region ? smooth(signedDistance(x, y, r.region) / Math.max(1, r.feather ?? 12) + 0.5) : 1;
    if (s <= 0) continue;
    if (r.chain && r.bones) {
      mixInto(w, chainWeights(x, y, r.chain, r.bones, r.parent ?? base, r.blend ?? 20, r.startBlend ?? 20), s);
    } else if (r.bone) {
      mixInto(w, new Map([[r.bone, 1]]), s);
    }
  }
  return w;
}

export function buildPuppet(asset: PuppetAsset, textures: Record<string, THREE.Texture>, originAnchor: string, renderOrder: number): Puppet {
  const m = asset.metresPerPx;
  const origin = asset.anchors[originAnchor] ?? [asset.width / 2, asset.height / 2];
  const local = ([x, y]: P2) => new THREE.Vector3((x - origin[0]) * m, (origin[1] - y) * m, 0);

  /* ---------- skeleton (bones at their pivots, parent-relative) ---------- */
  const boneNames = Object.keys(asset.bones);
  const index = new Map(boneNames.map((n, i) => [n, i]));
  const bones: Record<string, THREE.Bone> = {};
  const rest: Record<string, THREE.Vector3> = {};
  for (const n of boneNames) {
    bones[n] = new THREE.Bone();
    bones[n].name = n;
  }
  const roots: THREE.Bone[] = [];
  for (const n of boneNames) {
    const b = asset.bones[n];
    const pos = local(b.pivot);
    if (b.parent && bones[b.parent]) {
      pos.sub(local(asset.bones[b.parent].pivot));
      bones[b.parent].add(bones[n]);
    } else {
      roots.push(bones[n]);
    }
    bones[n].position.copy(pos);
    rest[n] = pos.clone();
  }

  const group = new THREE.Group();
  const meshes: Record<string, THREE.SkinnedMesh> = {};
  const materials: Record<string, THREE.MeshBasicMaterial> = {};
  let skeleton: THREE.Skeleton | null = null;
  let first: THREE.SkinnedMesh | null = null;

  asset.layers.forEach((L, li) => {
    const [rx, ry, rw, rh] = L.rect;
    const positions: number[] = [];
    const uvs: number[] = [];
    const skinIndex: number[] = [];
    const skinWeight: number[] = [];
    const idx: number[] = [];
    const ids = new Map<number, number>();
    const vtx = (cx: number, cy: number) => {
      const key = cy * (L.cols + 1) + cx;
      const found = ids.get(key);
      if (found !== undefined) return found;
      const id = positions.length / 3;
      ids.set(key, id);
      const sx = rx + Math.min(rw, cx * L.cell);
      const sy = ry + Math.min(rh, cy * L.cell);
      const p = local([sx, sy]);
      positions.push(p.x, p.y, 0);
      uvs.push((sx - rx) / rw, 1 - (sy - ry) / rh);
      const w = [...weightsAt(sx, sy, L.weights, L.bone).entries()].filter(([, v]) => v > 1e-3).sort((a, b) => b[1] - a[1]).slice(0, 4);
      const sum = w.reduce((a, [, v]) => a + v, 0) || 1;
      for (let k = 0; k < 4; k++) {
        skinIndex.push(w[k] ? index.get(w[k][0]) ?? 0 : 0);
        skinWeight.push(w[k] ? w[k][1] / sum : 0);
      }
      return id;
    };
    for (let cy = 0; cy < L.rows; cy++) {
      for (let cx = 0; cx < L.cols; cx++) {
        if (L.cover[cy * L.cols + cx] !== '1') continue;
        const a = vtx(cx, cy);
        const b = vtx(cx + 1, cy);
        const c = vtx(cx, cy + 1);
        const d = vtx(cx + 1, cy + 1);
        idx.push(a, c, b, b, c, d);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndex, 4));
    geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeight, 4));
    geometry.setIndex(idx);

    const material = new THREE.MeshBasicMaterial({
      map: textures[L.name],
      transparent: true,
      depthWrite: false,
      toneMapped: false,
      // mirrored flights flip the group: keep both faces
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.SkinnedMesh(geometry, material);
    mesh.name = L.name;
    mesh.frustumCulled = false;
    mesh.renderOrder = renderOrder + li;
    if (!first) {
      first = mesh;
      for (const r of roots) mesh.add(r);
      mesh.updateMatrixWorld(true);
      skeleton = new THREE.Skeleton(boneNames.map((n) => bones[n]));
      mesh.bind(skeleton);
    } else {
      mesh.bind(skeleton!, first.bindMatrix);
    }
    meshes[L.name] = mesh;
    materials[L.name] = material;
    group.add(mesh);
  });

  const tmp = new THREE.Vector3();
  const inv = new THREE.Matrix4();
  return {
    group,
    meshes,
    materials,
    bones,
    setPose(pose) {
      for (const n of boneNames) {
        const b = bones[n];
        const p = pose[n];
        b.position.copy(rest[n]);
        if (p) {
          b.position.x += p.x ?? 0;
          b.position.y += p.y ?? 0;
          b.rotation.z = p.r ?? 0;
          b.scale.set(p.sx ?? 1, p.sy ?? p.sx ?? 1, 1);
        } else {
          b.rotation.z = 0;
          b.scale.set(1, 1, 1);
        }
      }
    },
    setOpacity(o, layer) {
      for (const [k, mat] of Object.entries(materials)) if (!layer || k === layer) mat.opacity = o;
    },
    pointOnBone(bone, src, out) {
      // bone-space offset of the source point at rest, then through the bone's current matrix
      const b = bones[bone];
      const root = first!;
      root.updateMatrixWorld(true);
      inv.copy(root.matrixWorld).invert();
      tmp.copy(local(src)).sub(local(asset.bones[bone].pivot));
      out.copy(tmp).applyMatrix4(b.matrixWorld).applyMatrix4(inv);
      return out;
    },
    dispose() {
      for (const mesh of Object.values(meshes)) {
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
      }
      skeleton?.dispose();
    },
  };
}
