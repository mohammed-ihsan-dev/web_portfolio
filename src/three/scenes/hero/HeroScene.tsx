'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { solved } from '../../director/director';
import { heroLayout } from './heroLayout';
import { buildHandGeometry, POINTING, RELAXED_OPEN } from './handGeometry';
import { MacBook, MACBOOK } from '../../props/MacBook';

/** Plaster/stone look: subtle procedural grain + cavity darkening, no textures to download. */
function createStoneMaterial() {
  const mat = new THREE.MeshStandardMaterial({ color: '#d2cabe', roughness: 0.8, metalness: 0 });
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vStonePos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvStonePos = position;');
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec3 vStonePos;
float stoneHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float stoneNoise(vec3 x) {
  vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(stoneHash(i), stoneHash(i + vec3(1,0,0)), f.x), mix(stoneHash(i + vec3(0,1,0)), stoneHash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(stoneHash(i + vec3(0,0,1)), stoneHash(i + vec3(1,0,1)), f.x), mix(stoneHash(i + vec3(0,1,1)), stoneHash(i + vec3(1,1,1)), f.x), f.y), f.z);
}`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
float grain = stoneNoise(vStonePos * 9.0) * 0.6 + stoneNoise(vStonePos * 31.0) * 0.4;
float vein = smoothstep(0.62, 0.7, stoneNoise(vStonePos * 2.2 + 4.0));
diffuseColor.rgb *= 0.88 + grain * 0.18 - vein * 0.06;`,
      );
  };
  return mat;
}

export function HeroScene() {
  const root = useRef<THREE.Group>(null);
  const lower = useRef<THREE.Mesh>(null);
  const upper = useRef<THREE.Mesh>(null);
  const laptop = useRef<THREE.Group>(null);
  const lid = useRef<THREE.Group>(null);

  const { lowerGeo, upperGeo, stone } = useMemo(
    () => ({
      lowerGeo: buildHandGeometry(RELAXED_OPEN),
      upperGeo: buildHandGeometry(POINTING),
      stone: createStoneMaterial(),
    }),
    [],
  );
  useEffect(
    () => () => {
      lowerGeo.dispose();
      upperGeo.dispose();
      stone.dispose();
    },
    [lowerGeo, upperGeo, stone],
  );

  const L = heroLayout.lowerHand;
  const U = heroLayout.upperHand;

  useFrame((state) => {
    const g = root.current;
    if (!g) return;
    const h = solved.hero;
    g.visible = h.show;
    if (!h.show) return;
    const t = state.clock.elapsedTime;

    lower.current!.position.set(...L.position).add(h.lowerOffset);
    upper.current!.position.set(...U.position).add(h.upperOffset);
    // The reaching hand breathes slowly; the lower one stays still so the character stays planted.
    upper.current!.position.y += Math.sin(t * 0.45) * 0.03;
    upper.current!.rotation.z = U.rotation[2] + Math.sin(t * 0.35) * 0.012;

    // On his lap while he types; once closed it is set down on the palm beside him.
    const lap = laptop.current!;
    // The seated render carries its own MacBook; the 3D one takes over at the hand-over.
    lap.visible = h.laptopVisible;
    const a = h.laptopAside;
    lap.position.lerpVectors(heroLayout.laptop.lap, heroLayout.laptop.aside, a).add(h.lowerOffset);
    lap.position.y += Math.sin(Math.PI * a) * 0.08;
    lap.quaternion.slerpQuaternions(heroLayout.laptop.lapQuaternion, heroLayout.laptop.asideQuaternion, a);
    lid.current!.rotation.x = -MACBOOK.openAngle * h.lid;
  });

  return (
    <group ref={root}>
      <mesh
        ref={lower}
        geometry={lowerGeo}
        material={stone}
        position={L.position}
        rotation={L.rotation}
        scale={L.scale}
        castShadow
        receiveShadow
      />
      <mesh
        ref={upper}
        geometry={upperGeo}
        material={stone}
        position={U.position}
        rotation={U.rotation}
        scale={U.scale}
        castShadow
        receiveShadow
      />
      <MacBook ref={laptop} lidRef={lid} />
    </group>
  );
}
