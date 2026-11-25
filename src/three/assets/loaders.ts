/**
 * Renderer registry shared by asset loaders. The GLTF/KTX2 configuration
 * itself lives in ./gltf.ts, which is only reached through the lazily loaded
 * CharacterModel chunk — no loader code ships until a model is configured.
 */
import type * as THREE from 'three';

let renderer: THREE.WebGLRenderer | null = null;
const disposers = new Set<() => void>();

export function registerRenderer(gl: THREE.WebGLRenderer) {
  renderer = gl;
}

export function getRenderer() {
  return renderer;
}

export function onDisposeLoaders(fn: () => void) {
  disposers.add(fn);
}

export function disposeLoaders() {
  disposers.forEach((fn) => fn());
  disposers.clear();
  renderer = null;
}
