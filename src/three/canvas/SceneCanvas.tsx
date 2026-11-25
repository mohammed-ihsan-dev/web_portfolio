'use client';

/**
 * The one shared WebGL canvas (desktop-3d only). Fixed behind/in front of the
 * DOM per the layering contract, never intercepts pointer events, persists
 * across route changes. Any WebGL failure downgrades the site to the static
 * desktop layout instead of breaking it.
 */
import { Component, type ReactNode, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { forceStatic } from '@/lib/capabilities';
import { loading } from '@/lib/loading';
import { CANON } from '../director/director';
import { SceneRoot } from '../scenes/SceneRoot';
import { disposeLoaders, registerRenderer } from '../assets/loaders';
import { disposeProceduralTextures } from '../assets/proceduralTextures';
import styles from './SceneCanvas.module.css';

class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.error('[scene] WebGL scene failed; switching to the static layout.', error);
    forceStatic('scene error');
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export default function SceneCanvas() {
  useEffect(() => {
    loading.set('scene', 0.2);
    const manager = THREE.DefaultLoadingManager;
    manager.onProgress = (_url, loaded, total) => loading.set('scene', 0.25 + 0.6 * (loaded / Math.max(1, total)));
    manager.onError = (url) => console.warn('[scene] failed to load', url);
    return () => {
      manager.onProgress = () => {};
      disposeProceduralTextures();
      disposeLoaders();
    };
  }, []);

  return (
    <div className={styles.canvas} aria-hidden="true">
      <SceneBoundary>
        <Canvas
          frameloop="never"
          style={{ pointerEvents: 'none' }}
          flat={false}
          shadows="percentage"
          dpr={1}
          camera={{ fov: CANON.fov, near: 0.1, far: 60, position: [0, 0, CANON.z] }}
          gl={{ antialias: true, alpha: true, powerPreference: 'high-performance', stencil: false, depth: true }}
          onCreated={({ gl }) => {
            gl.setClearColor(0x000000, 0);
            gl.toneMapping = THREE.NeutralToneMapping;
            gl.outputColorSpace = THREE.SRGBColorSpace;
            registerRenderer(gl);
            gl.domElement.addEventListener('webglcontextlost', (e) => {
              e.preventDefault();
              forceStatic('webgl context lost');
            });
          }}
        >
          <SceneRoot />
        </Canvas>
      </SceneBoundary>
    </div>
  );
}
