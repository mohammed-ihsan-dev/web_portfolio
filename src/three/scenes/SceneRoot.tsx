'use client';

/**
 * Scene graph root. Parts mount in stages, one per idle slot, so geometry
 * building and shader compilation are spread over several short tasks
 * instead of one long main-thread block while the preloader is up.
 */
import { Suspense, useEffect, useState } from 'react';
import { useThree } from '@react-three/fiber';
import { bus, emit } from '@/lib/scene-bus';
import { loading } from '@/lib/loading';
import { FrameDriver, requestFrames } from '../canvas/FrameDriver';
import { CameraRig } from '../camera/CameraRig';
import { Lighting } from '../lighting/Lighting';
import { Sky } from './hero/Sky';
import { HeroScene } from './hero/HeroScene';
import { WorkspaceProps } from './workspace/WorkspaceProps';
import { FinaleScene } from './finale/FinaleScene';
import { ProjectPanels } from './work/ProjectPanels';
import { CharacterController } from '../character/CharacterController';
import { HeroPuppetPreload, Puppets } from '../puppet/PuppetScene';

const STAGES = 4;

function schedule(fn: () => void) {
  if (typeof window.requestIdleCallback === 'function') {
    const id = window.requestIdleCallback(fn, { timeout: 120 });
    return () => window.cancelIdleCallback(id);
  }
  const id = setTimeout(fn, 16);
  return () => clearTimeout(id);
}

/** Mounted once everything inside the Suspense boundary has loaded. */
function SceneReady() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);

  useEffect(() => {
    let cancelled = false;
    const finish = () => {
      if (cancelled) return;
      requestFrames(3);
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          if (cancelled) return;
          bus.sceneReady = true;
          document.documentElement.setAttribute('data-scene', 'ready');
          loading.done('scene');
          emit('scene:ready');
        }),
      );
    };
    // Compile remaining materials up front (parallel where KHR_parallel_shader_compile exists).
    gl.compileAsync(scene, camera).then(finish, finish);
    return () => {
      cancelled = true;
      bus.sceneReady = false;
      document.documentElement.removeAttribute('data-scene');
    };
  }, [gl, scene, camera]);

  return null;
}

export function SceneRoot() {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    if (stage >= STAGES) return;
    return schedule(() => {
      loading.set('scene', 0.3 + (0.5 * (stage + 1)) / STAGES);
      setStage((s) => s + 1);
    });
  }, [stage]);

  return (
    <>
      <FrameDriver />
      <CameraRig />
      <Lighting />
      {stage >= 1 && <Sky />}
      {stage >= 2 && <HeroScene />}
      {stage >= 3 && <WorkspaceProps />}
      {stage >= 3 && <FinaleScene />}
      {stage >= 4 && (
        <Suspense fallback={null}>
          <CharacterController />
          <HeroPuppetPreload />
          <Puppets />
          <ProjectPanels />
          <SceneReady />
        </Suspense>
      )}
    </>
  );
}
