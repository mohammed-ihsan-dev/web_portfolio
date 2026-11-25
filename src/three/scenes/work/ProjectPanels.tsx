'use client';

/**
 * Selected Work: four project panels (cover images from the mock data) that
 * fly out of the character's hands and settle exactly on their HTML links.
 * Positions come from the director; images use the Next image optimiser.
 */
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { featuredProjects } from '@/data/projects';
import { solved } from '../../director/director';

const sources = featuredProjects.slice(0, 4).map((p) => ({
  url: `/_next/image?url=${encodeURIComponent(p.cover.src)}&w=640&q=75`,
  aspect: p.cover.width / p.cover.height,
}));

export function ProjectPanels() {
  const textures = useTexture(
    sources.map((s) => s.url),
    (t) => {
      for (const tex of Array.isArray(t) ? t : [t]) {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 4;
      }
    },
  );
  const group = useRef<THREE.Group>(null);
  const meshes = useRef<(THREE.Mesh | null)[]>([]);
  const geometry = useMemo(() => new THREE.PlaneGeometry(1, 1), []);
  const materials = useMemo(
    () => textures.map((map) => new THREE.MeshBasicMaterial({ map, transparent: true, toneMapped: false, depthWrite: false })),
    [textures],
  );
  useEffect(
    () => () => {
      geometry.dispose();
      materials.forEach((m) => m.dispose());
    },
    [geometry, materials],
  );

  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const P = solved.panels;
    g.visible = P.show;
    if (!P.show) return;
    P.items.forEach((it, i) => {
      const m = meshes.current[i];
      if (!m) return;
      m.visible = it.opacity > 0.01;
      if (!m.visible) return;
      m.position.copy(it.pos);
      m.scale.set(it.w, it.h, 1);
      m.rotation.set(0, it.rotY, it.rotZ);
      const mat = materials[i];
      mat.opacity = it.opacity;
      // object-fit: cover
      const tex = mat.map!;
      const slot = it.w / Math.max(it.h, 1e-6);
      const img = sources[i].aspect;
      if (img > slot) tex.repeat.set(slot / img, 1);
      else tex.repeat.set(1, img / slot);
      tex.offset.set((1 - tex.repeat.x) / 2, (1 - tex.repeat.y) / 2);
    });
  });

  return (
    <group ref={group} visible={false}>
      {materials.map((mat, i) => (
        <mesh
          key={i}
          ref={(el) => {
            meshes.current[i] = el;
          }}
          geometry={geometry}
          material={mat}
          renderOrder={12}
        />
      ))}
    </group>
  );
}
