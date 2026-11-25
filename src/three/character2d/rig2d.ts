/**
 * 2D skeletal mesh for an image pose (Layered2DCharacter).
 *
 * One subdivided plane carries the whole cut-out. Each vertex is skinned to at
 * most two of 16 in-plane bones, with weights derived from the joint positions
 * and the arm outlines measured in the pose catalogue. Deforming one
 * continuous mesh (instead of moving separately cut layers) means there are no
 * holes where a limb used to cover the body.
 *
 * The head region is weighted 100 % to the head bone and every parent scale is
 * compensated, so the face is only translated/rotated — never stretched.
 */
import * as THREE from 'three';
import type { RigPose } from './rigPose';
import type { PoseAsset } from './poses';

const BONES = [
  'pelvis', 'spine', 'chest', 'head',
  'upperArmL', 'foreArmL', 'handL', 'upperArmR', 'foreArmR', 'handR',
  'thighL', 'shinL', 'footL', 'thighR', 'shinR', 'footR',
] as const;
type BoneName = (typeof BONES)[number];
const I = Object.fromEntries(BONES.map((b, i) => [b, i])) as Record<BoneName, number>;

type V2 = [number, number];

export interface RigMesh {
  mesh: THREE.SkinnedMesh;
  /** Optional static torso underlay drawn behind the arms (shares the skeleton). */
  under: THREE.SkinnedMesh | null;
  material: THREE.MeshBasicMaterial & { userData: { smear: { value: THREE.Vector2 } } };
  rigged: boolean;
  apply(p: RigPose): void;
  /** Sole midpoint in mesh-local metres under the current pose (call after apply). */
  feetOffset(out: THREE.Vector3): THREE.Vector3;
  dispose(): void;
}

function inPoly(x: number, y: number, poly: V2[]) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Weights along a joint chain (e.g. shoulder→elbow→wrist→fingertips) with soft blends at joints. */
function chain(p: V2, pts: V2[], bones: number[], parent: number, blend: number, startBlend: number): [number, number, number, number] {
  const seg: number[] = [0];
  for (let i = 1; i < pts.length; i++) seg.push(seg[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  let best = Infinity;
  let s = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i];
    const [bx, by] = pts[i + 1];
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy || 1e-9;
    const t = Math.max(0, Math.min(1, ((p[0] - ax) * dx + (p[1] - ay) * dy) / len2));
    const d = Math.hypot(ax + dx * t - p[0], ay + dy * t - p[1]);
    if (d < best) {
      best = d;
      s = seg[i] + t * (seg[i + 1] - seg[i]);
    }
  }
  if (s < startBlend) {
    const w = s / startBlend;
    return [parent, 1 - w, bones[0], w];
  }
  for (let k = 1; k < bones.length; k++) {
    const j = seg[k];
    if (Math.abs(s - j) < blend) {
      const w = (s - (j - blend)) / (2 * blend);
      return [bones[k - 1], 1 - w, bones[k], w];
    }
    if (s < j) return [bones[k - 1], 1, bones[k - 1], 0];
  }
  return [bones[bones.length - 1], 1, bones[bones.length - 1], 0];
}

const smearChunk = /* glsl */ `
#ifdef USE_MAP
  vec4 sampledDiffuseColor = texture2D( map, vMapUv );
  if ( dot( uSmear, uSmear ) > 1e-8 ) {
    vec4 acc = sampledDiffuseColor;
    for ( int i = 1; i <= 5; i++ ) acc += texture2D( map, vMapUv - uSmear * ( float( i ) / 5.0 ) );
    sampledDiffuseColor = acc / 6.0;
  }
  diffuseColor *= sampledDiffuseColor;
#endif`;

export function buildRigMesh(pose: PoseAsset, texture: THREE.Texture, underTexture?: THREE.Texture): RigMesh {
  const W = pose.worldWidth;
  const H = pose.worldHeight;
  const rig = pose.rig;
  const j = (name: string, fallback: V2): V2 => (rig?.joints[name] as V2) ?? fallback;
  // Origin: the pelvis for rigged poses, otherwise the pose's own anchor.
  const origin: V2 = rig ? j('pelvis', [0.5, 0.55]) : ((pose.anchor === 'hips' ? pose.anchors.hips : pose.anchors.feet) ?? [0.5, 1]);
  const toLocal = ([u, v]: V2) => new THREE.Vector3((u - origin[0]) * W, (origin[1] - v) * H, 0);
  const toMetres = ([u, v]: V2): V2 => [u * W, v * H];

  /* ---------- geometry ---------- */
  const parts = rig?.parts;
  const segX = parts ? parts.cols : rig ? 28 : 1;
  const segY = parts ? parts.rows : rig ? 84 : 1;
  const positions: number[] = [];
  const uvs: number[] = [];
  const skinIndex: number[] = [];
  const skinWeight: number[] = [];

  const neck = j('neck', [0.5, 0.18]);
  const chestJ = j('chest', [0.5, 0.27]);
  const spineJ = j('spine', [0.5, 0.4]);
  const pelvis = j('pelvis', [0.5, 0.54]);
  const armL = rig ? (rig.arms.L as V2[]) : [];
  const armR = rig ? (rig.arms.R as V2[]) : [];
  const armChainL = ['shoulderL', 'elbowL', 'wristL', 'fingersL'].map((n) => toMetres(j(n, [0.3, 0.3])));
  const armChainR = ['shoulderR', 'elbowR', 'wristR', 'fingersR'].map((n) => toMetres(j(n, [0.7, 0.3])));
  const legChainL = ['hipL', 'kneeL', 'ankleL', 'toeL'].map((n) => toMetres(j(n, [0.42, 0.6])));
  const legChainR = ['hipR', 'kneeR', 'ankleR', 'toeR'].map((n) => toMetres(j(n, [0.58, 0.6])));

  const weightsAt = (u: number, v: number, bodyOnly = false): [number, number, number, number] => {
    if (!rig) return [0, 1, 0, 0];
    const m: V2 = [u * W, v * H];
    if (!bodyOnly && inPoly(u, v, armL)) return chain(m, armChainL, [I.upperArmL, I.foreArmL, I.handL], I.chest, 0.035, 0.06);
    if (!bodyOnly && inPoly(u, v, armR)) return chain(m, armChainR, [I.upperArmR, I.foreArmR, I.handR], I.chest, 0.035, 0.06);
    const band = (a: number, b: number) => Math.max(0, Math.min(1, (v - a) / (b - a)));
    if (v < neck[1] + 0.012) {
      const t = band(neck[1] - 0.008, neck[1] + 0.012);
      return [I.head, 1 - t, I.chest, t];
    }
    if (v < chestJ[1]) return [I.chest, 1, I.chest, 0];
    if (v < spineJ[1]) {
      const t = band(chestJ[1], spineJ[1]);
      return [I.chest, 1 - t, I.spine, t];
    }
    if (v < pelvis[1] + 0.012) {
      const t = band(pelvis[1] - 0.05, pelvis[1] + 0.012);
      return [I.spine, 1 - t, I.pelvis, t];
    }
    return u < rig.crotchX
      ? chain(m, legChainL, [I.thighL, I.shinL, I.footL], I.pelvis, 0.045, 0.05)
      : chain(m, legChainR, [I.thighR, I.shinR, I.footR], I.pelvis, 0.045, 0.05);
  };

  /* Alpha coverage per cell (from the decoded image) so fully transparent
   * cells are skipped: invisible triangles can never smear when stretched. */
  const coverage = (() => {
    if (parts) return null;
    const img = texture.image as CanvasImageSource & { width: number; height: number };
    if (!img || !img.width || typeof document === 'undefined') return null;
    const cw = segX * 2;
    const ch = segY * 2;
    const canvas = document.createElement('canvas');
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, cw, ch);
    const a = ctx.getImageData(0, 0, cw, ch).data;
    return (ix: number, iy: number) => {
      // max alpha over the cell plus a one-sample margin
      let m = 0;
      for (let y = iy * 2 - 1; y <= iy * 2 + 2; y++)
        for (let x = ix * 2 - 1; x <= ix * 2 + 2; x++) if (x >= 0 && y >= 0 && x < cw && y < ch) m = Math.max(m, a[(y * cw + x) * 4 + 3]);
      return m;
    };
  })();

  /* Region per cell. Arms get their own vertices (they separate cleanly from the
   * body when they swing); head, torso and legs share one continuous sheet. */
  const regionOf = (u: number, v: number) => (!rig ? 0 : inPoly(u, v, armL) ? 1 : inPoly(u, v, armR) ? 2 : 0);
  const partAt = (ix: number, iy: number) => (parts ? parts.data[iy * parts.cols + ix] : null);
  const vertexIds = new Map<number, number>();
  const index: number[] = [];
  const vertex = (ix: number, iy: number, region: number) => {
    const key = (iy * (segX + 1) + ix) * 4 + region;
    let id = vertexIds.get(key);
    if (id !== undefined) return id;
    id = positions.length / 3;
    vertexIds.set(key, id);
    const u = ix / segX;
    const v = iy / segY;
    const pos = toLocal([u, v]);
    positions.push(pos.x, pos.y, 0);
    uvs.push(u, 1 - v);
    const [a, wa, b, wb] = region === 1
      ? chain([u * W, v * H], armChainL, [I.upperArmL, I.foreArmL, I.handL], I.chest, 0.035, 0.06)
      : region === 2
        ? chain([u * W, v * H], armChainR, [I.upperArmR, I.foreArmR, I.handR], I.chest, 0.035, 0.06)
        : weightsAt(u, v, true);
    skinIndex.push(a, b, 0, 0);
    skinWeight.push(wa, wb, 0, 0);
    return id;
  };
  const cellRegion = (ix: number, iy: number) => {
    const part = partAt(ix, iy);
    return part !== null ? (part === '1' ? 1 : part === '2' ? 2 : 0) : regionOf((ix + 0.5) / segX, (iy + 0.5) / segY);
  };
  const visible = (ix: number, iy: number) => {
    const part = partAt(ix, iy);
    if (part !== null) return part !== '.';
    return !coverage || coverage(ix, iy) >= 6;
  };
  const quad = (ix: number, iy: number, region: number, out: number[]) => {
    const a = vertex(ix, iy, region);
    const b = vertex(ix + 1, iy, region);
    const c = vertex(ix, iy + 1, region);
    const d = vertex(ix + 1, iy + 1, region);
    out.push(a, c, b, b, c, d);
  };
  // Body first, arms after: one mesh, drawn in index order, so arms overlap the body.
  const bodyIndex: number[] = [];
  const armIndex: number[] = [];
  for (let iy = 0; iy < segY; iy++) {
    for (let ix = 0; ix < segX; ix++) {
      if (!visible(ix, iy)) continue;
      const region = cellRegion(ix, iy);
      quad(ix, iy, region, region === 0 ? bodyIndex : armIndex);
    }
  }
  index.push(...bodyIndex, ...armIndex);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndex, 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeight, 4));
  geometry.setIndex(index);

  /* ---------- skeleton ---------- */
  const bones = {} as Record<BoneName, THREE.Bone>;
  for (const name of BONES) {
    bones[name] = new THREE.Bone();
    bones[name].name = name;
  }
  const rest: Partial<Record<BoneName, THREE.Vector3>> = {};
  const place = (child: BoneName, parent: BoneName | null, joint: V2, parentJoint: V2 | null) => {
    const pos = toLocal(joint);
    if (parentJoint) pos.sub(toLocal(parentJoint));
    bones[child].position.copy(pos);
    rest[child] = pos.clone();
    if (parent) bones[parent].add(bones[child]);
  };
  place('pelvis', null, pelvis, null);
  place('spine', 'pelvis', spineJ, pelvis);
  place('chest', 'spine', chestJ, spineJ);
  place('head', 'chest', neck, chestJ);
  const limb = (names: [BoneName, BoneName, BoneName], parent: BoneName, parentJoint: V2, joints: [string, string, string]) => {
    const [a, b, c] = joints.map((n) => j(n, parentJoint)) as [V2, V2, V2];
    place(names[0], parent, a, parentJoint);
    place(names[1], names[0], b, a);
    place(names[2], names[1], c, b);
  };
  limb(['upperArmL', 'foreArmL', 'handL'], 'chest', chestJ, ['shoulderL', 'elbowL', 'wristL']);
  limb(['upperArmR', 'foreArmR', 'handR'], 'chest', chestJ, ['shoulderR', 'elbowR', 'wristR']);
  limb(['thighL', 'shinL', 'footL'], 'pelvis', pelvis, ['hipL', 'kneeL', 'ankleL']);
  limb(['thighR', 'shinR', 'footR'], 'pelvis', pelvis, ['hipR', 'kneeR', 'ankleR']);

  /* ---------- material (with motion-smear for pose cuts) ---------- */
  const smear = { value: new THREE.Vector2() };
  const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, toneMapped: false }) as RigMesh['material'];
  material.userData.smear = smear;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uSmear = smear;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec2 uSmear;')
      .replace('#include <map_fragment>', smearChunk);
  };
  material.customProgramCacheKey = () => 'character-smear';

  const mesh = new THREE.SkinnedMesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = 10;
  mesh.add(bones.pelvis);
  mesh.updateMatrixWorld(true);
  mesh.bind(new THREE.Skeleton(BONES.map((b) => bones[b])));

  /* ---------- torso underlay (behind the arms, body-weighted, same skeleton) ---------- */
  let under: THREE.SkinnedMesh | null = null;
  if (rig?.underlay && underTexture && parts) {
    const cells = rig.underlay.cells;
    const pos: number[] = [];
    const uv: number[] = [];
    const si: number[] = [];
    const sw: number[] = [];
    const idx: number[] = [];
    const ids = new Map<number, number>();
    const vtx = (ix: number, iy: number) => {
      const key = iy * (segX + 1) + ix;
      let id = ids.get(key);
      if (id !== undefined) return id;
      id = pos.length / 3;
      ids.set(key, id);
      const u = ix / segX;
      const v = iy / segY;
      const p = toLocal([u, v]);
      pos.push(p.x, p.y, 0);
      uv.push(u, 1 - v);
      const [a, wa, b, wb] = weightsAt(u, v, true);
      si.push(a, b, 0, 0);
      sw.push(wa, wb, 0, 0);
      return id;
    };
    for (let iy = 0; iy < segY; iy++) {
      for (let ix = 0; ix < segX; ix++) {
        if (cells[iy * segX + ix] !== '1') continue;
        const a = vtx(ix, iy);
        const b = vtx(ix + 1, iy);
        const c = vtx(ix, iy + 1);
        const d = vtx(ix + 1, iy + 1);
        idx.push(a, c, b, b, c, d);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
    g.setIndex(idx);
    under = new THREE.SkinnedMesh(g, new THREE.MeshBasicMaterial({ map: underTexture, transparent: true, depthWrite: false, toneMapped: false }));
    under.frustumCulled = false;
    under.renderOrder = 9;
    under.bind(mesh.skeleton, mesh.bindMatrix);
  }

  /* ---------- feet (sole points in each foot bone's space) ---------- */
  const feetV = pose.anchors.feet?.[1] ?? 1;
  const soleL = toLocal([j('ankleL', [0.42, 0.9])[0], feetV]).sub(toLocal(j('ankleL', [0.42, 0.9])));
  const soleR = toLocal([j('ankleR', [0.58, 0.9])[0], feetV]).sub(toLocal(j('ankleR', [0.58, 0.9])));
  const staticFeet = toLocal(pose.anchors.feet ?? [0.5, 1]);
  const inv = new THREE.Matrix4();
  const tmpA = new THREE.Vector3();
  const tmpB = new THREE.Vector3();

  const apply = (p: RigPose) => {
    if (!rig) return;
    const B = bones;
    const chestSx = 1 + p.breathe * 0.006;
    const chestSy = 1 + p.breathe * 0.012;
    const torsoSy = p.bodyScaleY * chestSy;

    B.pelvis.position.set(p.hipShift, 0, 0);
    B.pelvis.rotation.z = p.lean * 0.35;
    B.spine.rotation.z = p.lean * 0.65;
    B.spine.scale.set(1, p.bodyScaleY, 1);
    B.chest.scale.set(chestSx, chestSy, 1);

    // Head: undo every inherited scale; only move and tilt.
    B.head.position.copy(rest.head!).add(tmpA.set(p.headX, p.headY, 0));
    B.head.scale.set(1 / chestSx, 1 / torsoSy, 1);
    B.head.rotation.z = p.headTilt;

    const arm = (u: BoneName, f: BoneName, h: BoneName, out: number, fout: number, us: number, fs: number, sign: number) => {
      B[u].rotation.z = sign * out;
      B[u].scale.set(1 / chestSx, us / torsoSy, 1);
      B[f].rotation.z = sign * fout;
      B[f].scale.set(1, fs / us, 1);
      B[h].scale.set(1, 1 / fs, 1);
    };
    arm('upperArmL', 'foreArmL', 'handL', p.armOutL, p.foreOutL, p.upperScaleL, p.foreScaleL, -1);
    arm('upperArmR', 'foreArmR', 'handR', p.armOutR, p.foreOutR, p.upperScaleR, p.foreScaleR, 1);

    const leg = (t: BoneName, s: BoneName, f: BoneName, out: number, inward: number, ts: number, ss: number, sign: number) => {
      B[t].rotation.z = sign * out;
      B[t].scale.set(1, ts, 1);
      B[s].rotation.z = -sign * inward;
      B[s].scale.set(1, ss / ts, 1);
      // Keep the shoes level and undistorted.
      B[f].rotation.z = -(sign * out - sign * inward) - p.lean * 0.35;
      B[f].scale.set(1, 1 / ss, 1);
    };
    leg('thighL', 'shinL', 'footL', p.thighOutL, p.shinInL, p.thighScaleL, p.shinScaleL, -1);
    leg('thighR', 'shinR', 'footR', p.thighOutR, p.shinInR, p.thighScaleR, p.shinScaleR, 1);
  };

  const feetOffset = (out: THREE.Vector3) => {
    if (!rig) return out.copy(staticFeet);
    bones.pelvis.updateMatrixWorld(true);
    inv.copy(mesh.matrixWorld).invert();
    tmpA.copy(soleL).applyMatrix4(bones.footL.matrixWorld).applyMatrix4(inv);
    tmpB.copy(soleR).applyMatrix4(bones.footR.matrixWorld).applyMatrix4(inv);
    // The lower sole touches the ground.
    return out.set((tmpA.x + tmpB.x) / 2, Math.min(tmpA.y, tmpB.y), 0);
  };

  return {
    mesh,
    under,
    material,
    rigged: Boolean(rig),
    apply,
    feetOffset,
    dispose() {
      geometry.dispose();
      material.dispose();
      if (under) {
        under.geometry.dispose();
        (under.material as THREE.Material).dispose();
      }
      mesh.skeleton.dispose();
    },
  };
}
