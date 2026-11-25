'use client';

/**
 * FrameSequenceCharacter — plays a prepared frame sequence (from
 * `npm run assets:character -- --frames …`) on a camera-facing plane, scrubbed
 * by progress so it reverses with scroll. Frames load on demand around the
 * current index; nothing loads until the choreography asks for a sequence.
 */
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import manifest from '../../../public/images/character/sequences/manifest.json';
import { solved } from '../director/director';

interface Sequence {
  name: string;
  count: number;
  width: number;
  height: number;
  base: string;
  worldHeight?: number;
}

const sequences = manifest.sequences as Sequence[];
const loader = new THREE.TextureLoader();
const WINDOW = 3;

export function FrameSequenceCharacter() {
  const mesh = useRef<THREE.Mesh>(null);
  const cache = useMemo(() => new Map<string, THREE.Texture>(), []);
  const material = useMemo(() => new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, toneMapped: false }), []);
  const geometry = useMemo(() => new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0), []);

  useEffect(
    () => () => {
      cache.forEach((t) => t.dispose());
      material.dispose();
      geometry.dispose();
    },
    [cache, material, geometry],
  );

  useFrame(() => {
    const m = mesh.current;
    if (!m) return;
    const f = solved.character.frames;
    const seq = f.name ? sequences.find((s) => s.name === f.name) : undefined;
    m.visible = Boolean(seq) && solved.character.show;
    if (!seq || !m.visible) return;

    const idx = Math.round(Math.max(0, Math.min(1, f.progress)) * (seq.count - 1));
    const url = (i: number) => `${seq.base}${String(i + 1).padStart(4, '0')}.webp`;
    for (let k = Math.max(0, idx - WINDOW); k <= Math.min(seq.count - 1, idx + WINDOW); k++) {
      const u = url(k);
      if (!cache.has(u)) {
        const tex = loader.load(u);
        tex.colorSpace = THREE.SRGBColorSpace;
        cache.set(u, tex);
      }
    }
    // Evict frames far from the playhead.
    for (const [u, tex] of cache) {
      const n = Number(u.slice(-9, -5)) - 1;
      if (Math.abs(n - idx) > WINDOW * 2) {
        tex.dispose();
        cache.delete(u);
      }
    }
    const tex = cache.get(url(idx));
    if (tex?.image && material.map !== tex) {
      material.map = tex;
      material.needsUpdate = true;
    }
    const h = seq.worldHeight ?? 1.9;
    m.scale.set((h * seq.width) / seq.height, h, 1);
    m.position.copy(solved.character.pos);
  });

  return <mesh ref={mesh} geometry={geometry} material={material} renderOrder={10} visible={false} frustumCulled={false} />;
}
