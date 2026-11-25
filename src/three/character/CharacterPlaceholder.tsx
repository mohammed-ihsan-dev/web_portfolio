'use client';

/**
 * TEMPORARY 2D STAND-IN. A transparent cut-out of the reference render on a
 * screen-aligned plane, sized to the same 1.75 m world height as the real
 * character. It has no skeleton and plays no animation states; the director
 * still moves it between stations so layout and choreography can be reviewed.
 * Replace by setting `characterConfig.model.url`.
 */
import { useMemo } from 'react';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { characterConfig } from '@/config/character.config';

export function CharacterPlaceholder() {
  const { src, aspect, footY } = characterConfig.placeholder;
  const texture = useTexture(src, (t) => {
    const tex = Array.isArray(t) ? t[0] : t;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
  });

  const geometry = useMemo(() => {
    // Image height such that sole → top of hair spans the character height.
    const h = characterConfig.height / footY;
    const g = new THREE.PlaneGeometry(h * aspect, h);
    g.translate(0, h / 2 - (1 - footY) * h, 0);
    return g;
  }, [aspect, footY]);

  return (
    <mesh geometry={geometry} renderOrder={10} name="character-placeholder">
      <meshBasicMaterial map={texture} transparent toneMapped={false} depthWrite={false} />
    </mesh>
  );
}
