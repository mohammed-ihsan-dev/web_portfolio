/**
 * GLTF loader extension. Meshopt decoding is bundled by drei (no CDN); Draco is
 * deliberately not used (drei's default would fetch a decoder from gstatic).
 * KTX2 is opt-in: `npm run assets:basis` and set `characterConfig.ktx2 = true`.
 */
import type { GLTFLoader } from 'three-stdlib';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { characterConfig } from '@/config/character.config';
import { getRenderer, onDisposeLoaders } from './loaders';

let ktx2: KTX2Loader | null = null;

export function extendGLTF(loader: GLTFLoader) {
  const renderer = getRenderer();
  if (!characterConfig.ktx2 || !renderer) return;
  if (!ktx2) {
    ktx2 = new KTX2Loader().setTranscoderPath('/basis/').detectSupport(renderer);
    onDisposeLoaders(() => {
      ktx2?.dispose();
      ktx2 = null;
    });
  }
  // three-stdlib's GLTFLoader accepts three's KTX2Loader at runtime.
  (loader as unknown as { setKTX2Loader: (l: KTX2Loader) => void }).setKTX2Loader(ktx2);
}
