'use client';

/**
 * Rigged3DCharacter — the real GLB path. Active only when
 * `characterConfig.model.url` is set; if the model fails to load or parse, the
 * image-based character takes over so the site keeps working.
 */
import { Component, lazy, type ReactNode, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { bus } from '@/lib/scene-bus';
import { dampAngle } from '@/lib/math';
import { solved } from '../director/director';

// The GLB pipeline (GLTFLoader, Meshopt, KTX2, mixer) is its own chunk, fetched only when a model is configured.
const CharacterModel = lazy(() => import('./CharacterModel').then((m) => ({ default: m.CharacterModel })));

class ModelBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.warn('[character] GLB failed, using the image-based character:', error);
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export function Rigged3DCharacter({ fallback }: { fallback: ReactNode }) {
  const group = useRef<THREE.Group>(null);

  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;
    const c = solved.character;
    g.visible = c.show;
    bus.debug.station = c.station;
    if (!c.show) return;
    // The GLB root sits at the feet; while seated/airborne the hips target leads.
    g.position.copy(c.pos).lerp(c.hips, c.anchor * 0);
    g.rotation.y = dampAngle(g.rotation.y, c.yaw, 7, dt);
  });

  return (
    <ModelBoundary fallback={fallback}>
      <group ref={group} visible={false}>
        <CharacterModel />
      </group>
    </ModelBoundary>
  );
}
