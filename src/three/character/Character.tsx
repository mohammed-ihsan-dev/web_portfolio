'use client';

import { Component, lazy, type ReactNode, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { hasCharacterModel } from '@/config/character.config';
import { bus } from '@/lib/scene-bus';
import { dampAngle } from '@/lib/math';
import { solved } from '../director/director';
import { CharacterPlaceholder } from './CharacterPlaceholder';

// The GLB pipeline (GLTFLoader, Meshopt, KTX2, mixer) is its own chunk, fetched only when a model is configured.
const CharacterModel = lazy(() => import('./CharacterModel').then((m) => ({ default: m.CharacterModel })));

/** If the GLB fails to load or parse, keep the site working with the placeholder. */
class ModelBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.warn('[character] model failed, using placeholder:', error);
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

const forward = new THREE.Vector3();

/** One persistent character instance. Position/yaw come from the director every frame. */
export function Character() {
  const group = useRef<THREE.Group>(null);
  const camera = useThree((s) => s.camera);
  const model = hasCharacterModel();

  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;
    const c = solved.character;
    g.visible = c.show;
    bus.debug.station = c.station;
    if (!c.show) return;
    g.position.copy(c.pos);
    if (model) {
      g.rotation.y = dampAngle(g.rotation.y, c.yaw, 7, dt);
    } else {
      // Screen-aligned: parallel to the image plane so it matches its DOM station exactly.
      camera.getWorldDirection(forward);
      g.rotation.y = Math.atan2(-forward.x, -forward.z);
      bus.debug.state = c.state;
    }
  });

  return (
    <group ref={group} visible={false}>
      {model ? (
        <ModelBoundary fallback={<CharacterPlaceholder />}>
          <CharacterModel />
        </ModelBoundary>
      ) : (
        <CharacterPlaceholder />
      )}
    </group>
  );
}
