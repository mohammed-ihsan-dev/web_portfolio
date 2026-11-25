'use client';

/**
 * Minimal studio: chair, desk, monitor, keyboard, mug. Procedural, real-world
 * scale, ~12 draw calls. Local frame: the chair sits at the origin and the
 * seated character faces +X toward the desk. The group follows the desk
 * station and is only rendered while that section is on screen.
 */
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { solved } from '../../director/director';
import { getScreenTexture, getShadowTexture } from '../../assets/proceduralTextures';

const DESK_X = 0.6;
const DESK_H = 0.74;

export function WorkspaceProps() {
  const group = useRef<THREE.Group>(null);

  const r = useMemo(() => {
    const oak = new THREE.MeshStandardMaterial({ color: '#d9c6a5', roughness: 0.62 });
    const steel = new THREE.MeshStandardMaterial({ color: '#1c1c1f', roughness: 0.45, metalness: 0.1 });
    const fabric = new THREE.MeshStandardMaterial({ color: '#2c2c30', roughness: 0.95 });
    const plastic = new THREE.MeshStandardMaterial({ color: '#16161a', roughness: 0.5 });
    const ceramic = new THREE.MeshStandardMaterial({ color: '#f1efe9', roughness: 0.35 });
    const screen = new THREE.MeshBasicMaterial({ map: getScreenTexture(), toneMapped: false });
    const shadow = new THREE.MeshBasicMaterial({ map: getShadowTexture(), transparent: true, depthWrite: false, toneMapped: false });
    return {
      materials: [oak, steel, fabric, plastic, ceramic, screen, shadow],
      oak,
      steel,
      fabric,
      plastic,
      ceramic,
      screen,
      shadow,
      top: new RoundedBoxGeometry(0.72, 0.035, 1.36, 2, 0.01),
      leg: new THREE.BoxGeometry(0.03, DESK_H - 0.035, 0.03),
      seat: new RoundedBoxGeometry(0.46, 0.08, 0.46, 3, 0.03),
      back: new RoundedBoxGeometry(0.07, 0.52, 0.44, 3, 0.03),
      post: new THREE.CylinderGeometry(0.022, 0.022, 0.36, 12),
      spoke: new THREE.BoxGeometry(0.3, 0.025, 0.04).translate(0.15, 0, 0),
      monitor: new RoundedBoxGeometry(0.03, 0.37, 0.62, 2, 0.008),
      panel: new THREE.PlaneGeometry(0.6, 0.35),
      neck: new THREE.BoxGeometry(0.025, 0.24, 0.05),
      foot: new RoundedBoxGeometry(0.16, 0.012, 0.22, 2, 0.005),
      keyboard: new RoundedBoxGeometry(0.13, 0.012, 0.42, 2, 0.004),
      mug: new THREE.CylinderGeometry(0.04, 0.036, 0.095, 20),
      panelFront: new RoundedBoxGeometry(0.022, 0.62, 1.3, 2, 0.008),
      mouse: new RoundedBoxGeometry(0.1, 0.03, 0.062, 3, 0.014),
      plane: new THREE.PlaneGeometry(1, 1),
    };
  }, []);

  useEffect(
    () => () => {
      Object.values(r).forEach((v) => {
        if (v instanceof THREE.BufferGeometry) v.dispose();
      });
      r.materials.forEach((m) => m.dispose());
    },
    [r],
  );

  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const d = solved.desk;
    g.visible = d.show;
    if (!d.show) return;
    g.position.copy(d.pos);
    g.rotation.y = d.yaw;
  });

  const legs: [number, number][] = [
    [DESK_X - 0.32, -0.62],
    [DESK_X + 0.32, -0.62],
    [DESK_X - 0.32, 0.62],
    [DESK_X + 0.32, 0.62],
  ];

  return (
    <group ref={group} visible={false}>
      {/* contact shadows */}
      <mesh geometry={r.plane} material={r.shadow} rotation={[-Math.PI / 2, 0, 0]} position={[DESK_X, 0.002, 0]} scale={[1.3, 1.9, 1]} />
      <mesh geometry={r.plane} material={r.shadow} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.003, 0]} scale={[0.85, 0.85, 1]} />

      {/* desk */}
      <mesh geometry={r.top} material={r.oak} position={[DESK_X, DESK_H - 0.0175, 0]} />
      {legs.map(([x, z]) => (
        <mesh key={`${x}${z}`} geometry={r.leg} material={r.steel} position={[x, (DESK_H - 0.035) / 2, z]} />
      ))}

      {/* modesty panel: the desk's front, between him and the camera (hides the legs) */}
      <mesh geometry={r.panelFront} material={r.oak} position={[DESK_X + 0.33, DESK_H - 0.34, 0]} />

      {/* monitor beside him, turned toward the chair */}
      <group position={[DESK_X + 0.02, DESK_H, 0.46]} rotation={[0, -0.69, 0]}>
        <mesh geometry={r.foot} material={r.plastic} position={[0, 0.006, 0]} />
        <mesh geometry={r.neck} material={r.plastic} position={[0.02, 0.12, 0]} />
        <mesh geometry={r.monitor} material={r.plastic} position={[0, 0.39, 0]} />
        <mesh geometry={r.panel} material={r.screen} position={[-0.0165, 0.39, 0]} rotation={[0, -Math.PI / 2, 0]} />
      </group>
      <mesh geometry={r.keyboard} material={r.plastic} position={[DESK_X - 0.17, DESK_H + 0.006, 0.02]} />
      <mesh geometry={r.mouse} material={r.plastic} position={[DESK_X - 0.16, DESK_H + 0.015, -0.3]} />
      <mesh geometry={r.mug} material={r.ceramic} position={[DESK_X + 0.08, DESK_H + 0.048, -0.5]} />

      {/* chair */}
      <mesh geometry={r.seat} material={r.fabric} position={[0, 0.46, 0]} />
      <mesh geometry={r.back} material={r.fabric} position={[-0.24, 0.78, 0]} rotation={[0, 0, -0.12]} />
      <mesh geometry={r.post} material={r.steel} position={[0, 0.25, 0]} />
      {[0, 1, 2, 3, 4].map((i) => (
        <mesh key={i} geometry={r.spoke} material={r.steel} position={[0, 0.06, 0]} rotation={[0, (i / 5) * Math.PI * 2, 0]} />
      ))}
    </group>
  );
}
