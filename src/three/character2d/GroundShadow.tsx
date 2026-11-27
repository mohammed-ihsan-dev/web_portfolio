'use client';

/**
 * Soft contact shadow under the character, on whatever it stands on. Shrinks
 * and fades while airborne, so jumps read as leaving the ground (the baked
 * shadow is stripped from the pose images for exactly this reason).
 */
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getShadowTexture } from '../assets/proceduralTextures';
import { solved } from '../director/director';

export function GroundShadow() {
  const mesh = useRef<THREE.Mesh>(null);
  const material = useMemo(
    () => new THREE.MeshBasicMaterial({ map: getShadowTexture(), transparent: true, depthWrite: false, toneMapped: false, opacity: 0 }),
    [],
  );
  const geometry = useMemo(() => new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), []);

  useFrame(() => {
    const m = mesh.current;
    if (!m) return;
    const s = solved.character.shadow;
    m.visible = (solved.character.show || solved.puppet.id === 'walking') && s.opacity > 0.01;
    if (!m.visible) return;
    m.position.copy(s.pos);
    m.scale.set(0.95 * s.scale, 1, 0.42 * s.scale);
    material.opacity = s.opacity;
  });

  return <mesh ref={mesh} geometry={geometry} material={material} renderOrder={9} visible={false} />;
}
