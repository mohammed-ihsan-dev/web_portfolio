'use client';

/**
 * Three lights, no environment map (a PMREM bake costs several shader compiles
 * at start-up for little visible gain here). Only the key light casts shadows,
 * and its shadow map re-renders only while the hero sculptures are on screen.
 * Warmer, stronger key in the hero; softer, frontal studio light on the pages.
 */
import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { lerp } from '@/lib/math';
import { solved } from '../director/director';

const HERO_KEY = new THREE.Vector3(-4, 6, 6);
const PAGE_KEY = new THREE.Vector3(-3, 4.5, 9);

export function Lighting() {
  const gl = useThree((s) => s.gl);
  const key = useRef<THREE.DirectionalLight>(null);
  const tmp = useMemo(() => new THREE.Vector3(), []);

  useFrame(() => {
    const b = solved.camBlend;
    // Shadows only matter for the sculptures; stop re-rendering the map once they're gone.
    gl.shadowMap.autoUpdate = solved.hero.show;
    if (key.current) {
      key.current.intensity = lerp(2.3, 1.9, b);
      key.current.position.copy(tmp.lerpVectors(HERO_KEY, PAGE_KEY, b));
    }
  });

  return (
    <>
      <hemisphereLight args={['#dfe8f7', '#a99d8c', 1.05]} />
      <directionalLight
        ref={key}
        color="#fff1df"
        intensity={2.3}
        position={[-4, 6, 6]}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0008}
        shadow-normalBias={0.045}
        shadow-radius={5}
        shadow-camera-left={-5}
        shadow-camera-right={5}
        shadow-camera-top={5}
        shadow-camera-bottom={-5}
        shadow-camera-near={1}
        shadow-camera-far={30}
      />
      <directionalLight color="#e4ecff" intensity={0.6} position={[5, 1.5, 6]} />
    </>
  );
}
