'use client';

/**
 * Rigged GLB character. Loaded only when `characterConfig.model.url` is set.
 * Normalises scale/origin (feet at y=0, facing +Z, 1.75 m), merges clips from
 * extra animation files, drives the AnimationController from the director,
 * then applies procedural look-at / blink / breathing.
 */
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { characterConfig, clipMap } from '@/config/character.config';
import { bus } from '@/lib/scene-bus';
import { clamp } from '@/lib/math';
import type { CharacterState } from '@/types/character';
import { solved } from '../director/director';
import { AnimationController } from '../animation/AnimationController';
import { extendGLTF } from '../assets/gltf';
import { findRig, ProceduralLayer } from './rig';

const LOOPED_BREATHING: CharacterState[] = ['idle', 'standing', 'sitIdle', 'think', 'breathing'];

export function CharacterModel() {
  const url = characterConfig.model.url!;
  const files = useGLTF([url, ...characterConfig.animations], false, true, extendGLTF);

  const { root, controller, layer } = useMemo(() => {
    const scene = files[0].scene;
    scene.traverse((o) => {
      const m = o as THREE.SkinnedMesh;
      if (m.isSkinnedMesh) m.frustumCulled = false;
      if (m.isMesh) {
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        // No environment map in this scene: keep metals readable under direct light only.
        mats.forEach((mat) => {
          const std = mat as THREE.MeshStandardMaterial;
          if (std.isMeshStandardMaterial) std.metalness = Math.min(std.metalness, 0.3);
        });
      }
    });
    const box = new THREE.Box3().setFromObject(scene);
    const size = box.getSize(new THREE.Vector3());
    const centre = box.getCenter(new THREE.Vector3());
    const s = (characterConfig.height / Math.max(size.y, 1e-3)) * characterConfig.model.scale;
    const wrapper = new THREE.Group();
    const inner = new THREE.Group();
    inner.rotation.y = characterConfig.model.yaw;
    scene.scale.setScalar(s);
    scene.position.set(-centre.x * s, -box.min.y * s, -centre.z * s);
    inner.add(scene);
    wrapper.add(inner);

    const clips = files.flatMap((f) => f.animations);
    const ctrl = new AnimationController(scene, clips, clipMap);
    return { root: wrapper, controller: ctrl, layer: new ProceduralLayer(findRig(scene)) };
  }, [files]);

  useEffect(() => {
    bus.characterReady = true;
    bus.debug.clips = controller.report();
    return () => {
      bus.characterReady = false;
      controller.dispose();
    };
  }, [controller]);

  const lastOneShot = useRef(0);

  useFrame((_, dt) => {
    const c = solved.character;
    if (!c.show) return;
    if (c.mode === 'scrub') {
      controller.scrub(c.scrub);
    } else if (c.oneShot && c.oneShotId !== lastOneShot.current) {
      lastOneShot.current = c.oneShotId;
      controller.play(c.oneShot, { once: true, then: c.state });
    } else {
      controller.play(c.state);
    }
    // Match the walk/run cycle to ground speed to keep feet from sliding.
    controller.setSpeed(c.state === 'walk' ? clamp(c.speed / 1.35, 0.55, 1.9) : c.state === 'run' ? clamp(c.speed / 3.6, 0.7, 1.6) : 1);
    controller.update(Math.min(dt, 0.05));
    layer.update(dt, c.look, c.lookWeight, LOOPED_BREATHING.includes(c.state));
    bus.debug.state = c.mode === 'scrub' ? (c.scrub[0]?.state ?? c.state) : c.state;
  });

  return <primitive object={root} />;
}
