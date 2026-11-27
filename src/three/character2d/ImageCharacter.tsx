'use client';

/**
 * MultiPoseCharacter + Layered2DCharacter.
 *
 * Mounts one PoseLayer per pose the choreography has asked for (lazily, max a
 * few at a time, textures loaded on demand). Each layer is a 2D skinned mesh
 * (see rig2d.ts) driven by the director's rig pose and placed so its feet or
 * hips land exactly on the solved anchor. Visibility, crossfades and motion
 * smear between poses are decided by the director, so this component stays a
 * thin renderer.
 */
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { solved } from '../director/director';
import { buildRigMesh, type RigMesh } from './rig2d';
import { bus } from '@/lib/scene-bus';
import { BASE_POSE, getPose, missingPoses, type PoseId } from './poses';
import { readyPoses, requestedPoses } from './runtime';

const MAX_MOUNTED = 3;
const NO_SMEAR = new THREE.Vector2();

function PoseLayer({ id }: { id: PoseId }) {
  const asset = getPose(id);
  const urls = asset.rig?.underlay ? [asset.src, asset.rig.underlay.src] : [asset.src];
  const textures = useTexture(urls, (t) => {
    for (const tex of Array.isArray(t) ? t : [t]) {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 4;
    }
  });
  const [texture, underTexture] = textures;
  const group = useRef<THREE.Group>(null);
  const rig: RigMesh = useMemo(() => buildRigMesh(asset, texture, underTexture), [asset, texture, underTexture]);
  const s = useMemo(() => ({ feet: new THREE.Vector3(), pelvis: new THREE.Vector3() }), []);

  useEffect(() => {
    readyPoses.add(id);
    return () => {
      readyPoses.delete(id);
      rig.dispose();
    };
  }, [id, rig]);

  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const c = solved.character;
    const img = c.image;
    const opacity = id === img.current ? img.mix : id === img.prev ? 1 - img.mix : 0;
    g.visible = c.show && opacity > 0.001;
    if (!g.visible) return;
    rig.material.opacity = opacity * c.fade;
    if (rig.under) (rig.under.material as THREE.MeshBasicMaterial).opacity = opacity * c.fade;
    rig.material.userData.smear.value.copy(id === img.current ? img.smear : NO_SMEAR);

    // Only the base pose carries the synthesised presets; dedicated pose images get the living layer.
    rig.apply(id === BASE_POSE ? c.rig : c.rigOverlay);
    rig.feetOffset(s.feet);
    // Pelvis placement: blend between "feet on c.pos" and "hips on c.hips".
    if (rig.rigged) {
      s.pelvis.copy(c.pos).sub(s.feet).lerp(c.hips, c.anchor);
    } else {
      const atHips = asset.anchor === 'hips';
      s.pelvis.copy(atHips ? c.hips : c.pos);
    }
    g.position.copy(s.pelvis);
  });

  return (
    <group ref={group} visible={false}>
      {rig.under && <primitive object={rig.under} />}
      <primitive object={rig.mesh} />
    </group>
  );
}

export function ImageCharacter() {
  const [mounted, setMounted] = useState<PoseId[]>([BASE_POSE]);
  const mountedRef = useRef(mounted);

  useEffect(() => {
    bus.debug.clips = `2.5D image character (2D skeletal mesh on your render)\nposes still needed: ${missingPoses.join(', ') || 'none'}`;
  }, []);

  // Mount newly requested poses (rare state updates, never per frame).
  useFrame(() => {
    const current = mountedRef.current;
    let next: PoseId[] | null = null;
    for (const id of requestedPoses) {
      if (!current.includes(id) && !(next ?? []).includes(id)) next = [...(next ?? current), id];
    }
    if (!next) return;
    // Keep the base pose and the most recent requests.
    const keep = [BASE_POSE, ...next.filter((p) => p !== BASE_POSE).slice(-(MAX_MOUNTED - 1))];
    mountedRef.current = keep;
    setMounted(keep);
  });

  return (
    <>
      {mounted.map((id) => (
        <Suspense key={id} fallback={null}>
          <PoseLayer id={id} />
        </Suspense>
      ))}
    </>
  );
}
