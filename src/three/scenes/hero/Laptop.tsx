'use client';

/**
 * Minimal procedural laptop (~0.34 m wide). The lid is a separate pivot on the
 * hinge so it can be closed by scroll. Real-world scale matches the character.
 */
import { forwardRef, useMemo } from 'react';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { getScreenTexture } from '../../assets/proceduralTextures';

export const LAPTOP = { width: 0.34, depth: 0.235, base: 0.014, lid: 0.008, openAngle: (108 * Math.PI) / 180 };

export const Laptop = forwardRef<THREE.Group, { lidRef: React.Ref<THREE.Group> }>(function Laptop({ lidRef }, ref) {
  const { baseGeo, lidGeo, keysGeo, screenGeo, aluminium, keys, screen } = useMemo(() => {
    const { width, depth, base, lid } = LAPTOP;
    return {
      baseGeo: new RoundedBoxGeometry(width, base, depth, 2, 0.005),
      lidGeo: new RoundedBoxGeometry(width, lid, depth, 2, 0.004),
      keysGeo: new THREE.PlaneGeometry(width * 0.84, depth * 0.42),
      screenGeo: new THREE.PlaneGeometry(width * 0.92, depth * 0.88),
      aluminium: new THREE.MeshStandardMaterial({ color: '#d4d5d9', metalness: 0.18, roughness: 0.4 }),
      keys: new THREE.MeshStandardMaterial({ color: '#202126', roughness: 0.7 }),
      screen: new THREE.MeshBasicMaterial({ map: getScreenTexture(), toneMapped: false }),
    };
  }, []);

  const { depth, base, lid } = LAPTOP;
  return (
    <group ref={ref}>
      <mesh geometry={baseGeo} material={aluminium} position={[0, base / 2, 0]} />
      <mesh geometry={keysGeo} material={keys} rotation={[-Math.PI / 2, 0, 0]} position={[0, base + 0.0006, -depth * 0.12]} />
      {/* hinge at the back edge; lid closed lies over the base, rotation.x opens it */}
      <group ref={lidRef} position={[0, base, -depth / 2]}>
        <group position={[0, lid / 2, depth / 2]}>
          <mesh geometry={lidGeo} material={aluminium} />
          <mesh geometry={screenGeo} material={screen} rotation={[Math.PI / 2, 0, 0]} position={[0, -lid / 2 - 0.0006, 0]} />
        </group>
      </group>
    </group>
  );
});
