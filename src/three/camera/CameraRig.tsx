'use client';

/**
 * Blends between the hero camera (parallax, entrance dolly) and the canonical
 * page camera that every DOM station is solved against. At blend = 1 the
 * camera is exactly canonical, so the character lands on its DOM anchor.
 */
import { useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { bus } from '@/lib/scene-bus';
import { damp, easeOutCubic } from '@/lib/math';
import { CANON, solved } from '../director/director';
import { heroLayout } from '../scenes/hero/heroLayout';

const CANON_POS = new THREE.Vector3(0, 0, CANON.z);
const CANON_TARGET = new THREE.Vector3(0, 0, 0);

export function CameraRig() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const s = useMemo(() => ({ pos: new THREE.Vector3(), target: new THREE.Vector3(), px: 0, py: 0 }), []);

  useFrame((_, dt) => {
    if (camera.fov !== CANON.fov) {
      camera.fov = CANON.fov;
      camera.updateProjectionMatrix();
    }
    const b = solved.camBlend;
    const heroWeight = 1 - b;
    s.px = damp(s.px, bus.pointer.active ? bus.pointer.nx : 0, 2.5, dt);
    s.py = damp(s.py, bus.pointer.active ? bus.pointer.ny : 0, 2.5, dt);
    solved.parallax.set(s.px * heroWeight, s.py * heroWeight);

    const k = heroLayout.camera.parallax * heroWeight;
    const ent = 1 - easeOutCubic(solved.hero.entrance);
    s.pos.copy(heroLayout.camera.position);
    s.pos.x += s.px * k;
    s.pos.y += s.py * k * 0.6;
    s.pos.z += ent * heroLayout.camera.entranceDolly;
    s.pos.lerp(CANON_POS, b);
    s.target.copy(heroLayout.camera.target).lerp(CANON_TARGET, b);
    camera.position.copy(s.pos);
    camera.lookAt(s.target);
  });

  return null;
}
